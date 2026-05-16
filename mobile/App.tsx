import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AuthLoadingScreen from './src/screens/AuthLoadingScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import IdVerificationScreen from './src/screens/IdVerificationScreen';
import VerificationPendingScreen from './src/screens/VerificationPendingScreen';
import UploadScreen from './src/screens/UploadScreen';
import DetailsScreen from './src/screens/DetailsScreen';
import SuccessScreen from './src/screens/SuccessScreen';
import type { RootStackParamList } from './src/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="AuthLoading"
          screenOptions={{
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { fontWeight: '800', color: '#111827' },
          }}
        >
          <Stack.Screen
            name="AuthLoading"
            component={AuthLoadingScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Signup"
            component={SignupScreen}
            options={{ title: 'Create account' }}
          />
          <Stack.Screen
            name="IdVerification"
            component={IdVerificationScreen}
            options={{ title: 'Identity Verification' }}
          />
          <Stack.Screen
            name="VerificationPending"
            component={VerificationPendingScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Upload"
            component={UploadScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Details"
            component={DetailsScreen}
            options={{ title: 'Confirm Report' }}
          />
          <Stack.Screen
            name="Success"
            component={SuccessScreen}
            options={{ headerShown: false, gestureEnabled: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
