import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLoginView) {
        await login(email, password);
      } else {
        // Provide a fallback name if they leave it blank
        await register(email, password, name || 'New User');
      }
      // If successful, the context updates and we redirect to the dashboard
      navigate('/dashboard'); 
    } catch (err) {
      console.error(err);
      // Display the specific error from fastapi-users if available
      if (err.response && err.response.data && err.response.data.detail) {
        // Sometimes detail is an array of validation errors, sometimes a string
        const detail = err.response.data.detail;
        setError(typeof detail === 'string' ? detail : "Invalid input provided.");
      } else {
        setError("Authentication failed. Please check your connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">
            {isLoginView ? 'Welcome back' : 'Create an account'}
          </CardTitle>
          <CardDescription>
            {isLoginView 
              ? 'Enter your email and password to sign in to KronaFlow' 
              : 'Enter your details below to create your secure account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {!isLoginView && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input 
                  id="name" 
                  placeholder="John Doe" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLoginView}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="m@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                minLength={8} // fastapi-users requires an 8-char password by default!
              />
            </div>
            
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Please wait..." : (isLoginView ? 'Sign In' : 'Sign Up')}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-gray-500">
            {isLoginView ? "Don't have an account? " : "Already have an account? "}
            <button 
              type="button"
              className="font-medium text-blue-600 hover:underline"
              onClick={() => {
                setIsLoginView(!isLoginView);
                setError('');
              }}
            >
              {isLoginView ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}