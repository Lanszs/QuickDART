"""
Grad-CAM (Gradient-weighted Class Activation Mapping) for ResNet50.

Generates attention heatmaps showing where the model focuses when making predictions.
Converts heatmaps to bounding box coordinates for visualization overlay.
"""

import torch
import numpy as np
import cv2


class GradCAM:
    """Grad-CAM implementation for ResNet50 models."""

    def __init__(self, model, target_layer_name="layer4"):
        self.model = model
        self.activations = None
        self.gradients = None

        # Get the target layer
        target_layer = dict(model.named_modules())[target_layer_name]

        # Register hooks
        target_layer.register_forward_hook(self._forward_hook)
        target_layer.register_full_backward_hook(self._backward_hook)

    def _forward_hook(self, module, input, output):
        self.activations = output.detach()

    def _backward_hook(self, module, grad_input, grad_output):
        self.gradients = grad_output[0].detach()

    def compute_heatmap(self, input_tensor, target_class=None):
        """
        Compute Grad-CAM heatmap for the given input.

        Args:
            input_tensor: Preprocessed image tensor (1, 3, 224, 224)
            target_class: Class index to explain. If None, uses predicted class.

        Returns:
            heatmap: numpy array (H, W) normalized to [0, 1]
            predicted_class: int, the predicted class index
        """
        self.model.eval()

        # Forward pass with gradients
        input_tensor = input_tensor.clone().requires_grad_(True)
        output = self.model(input_tensor)

        if target_class is None:
            target_class = output.argmax(dim=1).item()

        # Backward pass from target class score
        self.model.zero_grad()
        target_score = output[0, target_class]
        target_score.backward()

        # Compute Grad-CAM
        # Global average pool the gradients -> channel weights
        weights = self.gradients.mean(dim=(2, 3), keepdim=True)  # (1, C, 1, 1)

        # Weighted combination of activation maps
        cam = (weights * self.activations).sum(dim=1, keepdim=True)  # (1, 1, H, W)
        cam = torch.relu(cam)  # ReLU to keep only positive influence
        cam = cam.squeeze().cpu().numpy()  # (H, W)

        # Normalize to [0, 1]
        if cam.max() > 0:
            cam = cam / cam.max()

        return cam, target_class


def heatmap_to_bbox(heatmap, threshold=0.4):
    """
    Convert a Grad-CAM heatmap to a bounding box.

    Args:
        heatmap: numpy array (H, W) with values in [0, 1]
        threshold: activation threshold for region detection

    Returns:
        dict with normalized bbox coords {x, y, w, h} in [0, 1] range,
        or None if no significant activation found
    """
    h, w = heatmap.shape
    mask = heatmap >= threshold

    if not mask.any():
        # Lower threshold and try again
        mask = heatmap >= (threshold * 0.5)
        if not mask.any():
            return None

    # Find bounding rectangle of active region
    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]

    # Convert to normalized coordinates [0, 1]
    return {
        "x": round(float(cmin) / w, 4),
        "y": round(float(rmin) / h, 4),
        "w": round(float(cmax - cmin) / w, 4),
        "h": round(float(rmax - rmin) / h, 4)
    }


def heatmap_to_bboxes(heatmap, threshold=0.4, min_area_ratio=0.01):
    """
    Convert a Grad-CAM heatmap to multiple bounding boxes using connected component analysis.

    Args:
        heatmap: numpy array (H, W) with values in [0, 1]
        threshold: activation threshold for region detection
        min_area_ratio: minimum component area as fraction of total heatmap area

    Returns:
        list of dicts with {x, y, w, h, intensity}, sorted by intensity descending.
        Coordinates are normalized to [0, 1].
    """
    h, w = heatmap.shape
    total_area = h * w
    mask = (heatmap >= threshold).astype(np.uint8)

    if not mask.any():
        # Lower threshold fallback
        mask = (heatmap >= threshold * 0.5).astype(np.uint8)
        if not mask.any():
            return []

    num_labels, labels = cv2.connectedComponents(mask)

    bboxes = []
    for label_id in range(1, num_labels):  # skip background (0)
        component_mask = (labels == label_id)
        component_area = component_mask.sum()

        # Filter tiny noise components
        if component_area / total_area < min_area_ratio:
            continue

        rows = np.any(component_mask, axis=1)
        cols = np.any(component_mask, axis=0)
        rmin, rmax = np.where(rows)[0][[0, -1]]
        cmin, cmax = np.where(cols)[0][[0, -1]]

        # Average heatmap intensity within this component
        intensity = float(heatmap[component_mask].mean())

        bboxes.append({
            "x": round(float(cmin) / w, 4),
            "y": round(float(rmin) / h, 4),
            "w": round(float(cmax - cmin) / w, 4),
            "h": round(float(rmax - rmin) / h, 4),
            "intensity": round(intensity, 4)
        })

    # Sort by intensity descending (most activated region first)
    bboxes.sort(key=lambda b: b["intensity"], reverse=True)
    return bboxes


def compute_gradcam_for_frame(type_model, damage_model, input_tensor,
                               type_gradcam, damage_gradcam):
    """
    Run Grad-CAM on both models for a single frame.

    Args:
        type_model: disaster type classification model
        damage_model: damage level classification model
        input_tensor: preprocessed tensor (1, 3, 224, 224)
        type_gradcam: GradCAM instance for type model
        damage_gradcam: GradCAM instance for damage model

    Returns:
        dict with type_bbox and damage_bbox, plus heatmap data for visualization
    """
    # Type model Grad-CAM
    type_heatmap, _ = type_gradcam.compute_heatmap(input_tensor)
    type_bbox = heatmap_to_bbox(type_heatmap)

    # Damage model Grad-CAM
    damage_heatmap, _ = damage_gradcam.compute_heatmap(input_tensor)
    damage_bbox = heatmap_to_bbox(damage_heatmap)
    damage_bboxes = heatmap_to_bboxes(damage_heatmap)

    # Convert heatmaps to serializable lists (downsampled for JSON size)
    # Heatmaps are 7x7 from ResNet50 layer4, resize to 14x14 for smoother overlay
    type_heatmap_list = np.round(type_heatmap, 3).tolist()
    damage_heatmap_list = np.round(damage_heatmap, 3).tolist()

    return {
        "type_bbox": type_bbox,
        "damage_bbox": damage_bbox,
        "damage_bboxes": damage_bboxes,
        "type_heatmap": type_heatmap_list,
        "damage_heatmap": damage_heatmap_list
    }
