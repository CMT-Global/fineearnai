import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class AdminErrorBoundaryClass extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Admin Error Boundary caught an error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <AdminErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
          title={this.props.fallbackTitle}
        />
      );
    }

    return this.props.children;
  }
}

interface FallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
  title?: string;
}

function AdminErrorFallback({ error, errorInfo, onReset, title }: FallbackProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-2xl">
                {title || "Something went wrong"}
              </CardTitle>
              <CardDescription>
                An error occurred in the admin panel
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
              <p className="font-medium text-sm mb-2">Error Details:</p>
              <pre className="text-xs overflow-x-auto whitespace-pre-wrap text-destructive">
                {error.toString()}
              </pre>
            </div>
          )}

          {errorInfo && process.env.NODE_ENV === 'development' && (
            <details className="rounded-lg bg-muted p-4 text-xs">
              <summary className="cursor-pointer font-medium mb-2">
                Stack Trace (Development Only)
              </summary>
              <pre className="overflow-x-auto whitespace-pre-wrap text-muted-foreground">
                {errorInfo.componentStack}
              </pre>
            </details>
          )}

          <div className="flex gap-3 pt-4">
            <Button onClick={onReset} className="flex-1">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reload Page
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/admin")}
              className="flex-1"
            >
              <Home className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center pt-2">
            If this problem persists, please contact technical support
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Wrapper component to use hooks
export function AdminErrorBoundary({ children, fallbackTitle }: Props) {
  return (
    <AdminErrorBoundaryClass fallbackTitle={fallbackTitle}>
      {children}
    </AdminErrorBoundaryClass>
  );
}
