/**
 * Admin monitoring and performance tracking utilities
 * Helps identify slow operations and potential issues
 */

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  metadata?: Record<string, any>;
}

class AdminMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 100;

  /**
   * Track an admin operation
   */
  async trackOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    const timestamp = Date.now();
    let success = false;
    let error: any = null;

    try {
      const result = await operation();
      success = true;
      return result;
    } catch (err) {
      error = err;
      throw err;
    } finally {
      const duration = performance.now() - startTime;

      this.recordMetric({
        operation: operationName,
        duration,
        timestamp,
        success,
        metadata: {
          ...metadata,
          error: error?.message,
        },
      });

      // Log slow operations (>3 seconds)
      if (duration > 3000) {
        console.warn(`[Admin Monitor] Slow operation detected: ${operationName}`, {
          duration: `${duration.toFixed(2)}ms`,
          success,
          metadata,
        });
      }

      // Log failed operations
      if (!success) {
        console.error(`[Admin Monitor] Operation failed: ${operationName}`, {
          duration: `${duration.toFixed(2)}ms`,
          error: error?.message,
          metadata,
        });
      }
    }
  }

  /**
   * Record a metric
   */
  private recordMetric(metric: PerformanceMetric) {
    this.metrics.push(metric);

    // Keep only last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    if (this.metrics.length === 0) {
      return {
        totalOperations: 0,
        avgDuration: 0,
        successRate: 0,
        slowOperations: [],
      };
    }

    const totalOperations = this.metrics.length;
    const successfulOps = this.metrics.filter((m) => m.success).length;
    const avgDuration =
      this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalOperations;

    const slowOperations = this.metrics
      .filter((m) => m.duration > 2000)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)
      .map((m) => ({
        operation: m.operation,
        duration: `${m.duration.toFixed(2)}ms`,
        timestamp: new Date(m.timestamp).toISOString(),
      }));

    return {
      totalOperations,
      avgDuration: `${avgDuration.toFixed(2)}ms`,
      successRate: `${((successfulOps / totalOperations) * 100).toFixed(1)}%`,
      slowOperations,
    };
  }

  /**
   * Get failed operations
   */
  getFailedOperations() {
    return this.metrics
      .filter((m) => !m.success)
      .slice(-20)
      .map((m) => ({
        operation: m.operation,
        error: m.metadata?.error,
        timestamp: new Date(m.timestamp).toISOString(),
      }));
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics = [];
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics() {
    return {
      metrics: this.metrics,
      summary: this.getPerformanceSummary(),
      failed: this.getFailedOperations(),
      exportedAt: new Date().toISOString(),
    };
  }
}

// Singleton instance
export const adminMonitor = new AdminMonitor();

/**
 * React Query error handler for admin operations
 */
export function handleAdminError(error: any, operation: string) {
  console.error(`[Admin Error] ${operation}:`, error);

  // Extract meaningful error message
  let message = "An unexpected error occurred";

  if (error?.message) {
    message = error.message;
  } else if (error?.error?.message) {
    message = error.error.message;
  } else if (typeof error === "string") {
    message = error;
  }

  // Log to monitoring
  adminMonitor.trackOperation(
    `error_${operation}`,
    async () => {
      throw new Error(message);
    },
    { errorType: error?.name || "UnknownError" }
  ).catch(() => {});

  return message;
}

/**
 * Network request logger
 */
export function logAdminRequest(
  endpoint: string,
  method: string,
  payload?: any
) {
  if (process.env.NODE_ENV === "development") {
    console.log(`[Admin Request] ${method} ${endpoint}`, {
      payload,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Cache status checker
 */
export function checkCacheHealth(queryClient: any) {
  const cache = queryClient.getQueryCache();
  const queries = cache.getAll();

  const staleQueries = queries.filter((q) => q.isStale());
  const errorQueries = queries.filter((q) => q.state.status === "error");
  const loadingQueries = queries.filter((q) => q.state.status === "pending");

  return {
    total: queries.length,
    stale: staleQueries.length,
    errors: errorQueries.length,
    loading: loadingQueries.length,
    healthy: queries.length - staleQueries.length - errorQueries.length,
  };
}

/**
 * Performance markers for React components
 */
export function markComponentRender(componentName: string) {
  if (process.env.NODE_ENV === "development") {
    performance.mark(`${componentName}_render`);
  }
}

export function measureComponentPerformance(
  componentName: string,
  startMark: string
) {
  if (process.env.NODE_ENV === "development") {
    try {
      const endMark = `${componentName}_complete`;
      performance.mark(endMark);
      performance.measure(componentName, startMark, endMark);

      const measure = performance.getEntriesByName(componentName)[0];
      if (measure && measure.duration > 100) {
        console.warn(
          `[Performance] Slow component render: ${componentName}`,
          `${measure.duration.toFixed(2)}ms`
        );
      }
    } catch (error) {
      // Ignore performance API errors
    }
  }
}
