import { Component, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

export class PartnerApplicationsErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Partner Applications Error Boundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="container mx-auto p-6 space-y-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Partner Applications Error</AlertTitle>
            <AlertDescription>
              Something went wrong while loading partner applications. This could be due to a database query issue or data structure problem.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Error Details
              </CardTitle>
              <CardDescription>
                The following error occurred while rendering the partner applications panel
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Error Message:</h3>
                  <pre className="bg-muted p-4 rounded-md overflow-auto text-xs">
                    {this.state.error.toString()}
                  </pre>
                </div>
              )}

              {this.state.errorInfo && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Component Stack:</h3>
                  <pre className="bg-muted p-4 rounded-md overflow-auto text-xs max-h-64">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button onClick={this.handleReset} variant="default">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload Page
                </Button>
                <Button onClick={() => window.history.back()} variant="outline">
                  Go Back
                </Button>
              </div>

              <Alert>
                <AlertTitle>Possible Solutions:</AlertTitle>
                <AlertDescription className="space-y-2 mt-2">
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Check if the database foreign key relationships are properly set up</li>
                    <li>Verify that the query syntax in usePartnerManagement.ts uses explicit FK references</li>
                    <li>Ensure user profiles exist for all partner applications</li>
                    <li>Check the browser console for detailed error messages</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
