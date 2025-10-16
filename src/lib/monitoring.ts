// Performance monitoring utilities for Phase 5 testing

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private marks: Map<string, number> = new Map();

  start(name: string) {
    this.marks.set(name, performance.now());
    console.log(`⏱️ Started: ${name}`);
  }

  end(name: string) {
    const startTime = this.marks.get(name);
    if (!startTime) {
      console.warn(`⚠️ No start mark found for: ${name}`);
      return;
    }

    const duration = performance.now() - startTime;
    this.metrics.push({
      name,
      duration,
      timestamp: Date.now(),
    });

    this.marks.delete(name);

    const emoji = duration < 100 ? "✅" : duration < 500 ? "⚡" : "🐌";
    console.log(`${emoji} Completed: ${name} in ${duration.toFixed(2)}ms`);

    return duration;
  }

  getMetrics() {
    return [...this.metrics];
  }

  getAverageDuration(name: string) {
    const filtered = this.metrics.filter(m => m.name === name);
    if (filtered.length === 0) return 0;
    
    const total = filtered.reduce((sum, m) => sum + m.duration, 0);
    return total / filtered.length;
  }

  clear() {
    this.metrics = [];
    this.marks.clear();
  }

  report() {
    console.group("📊 Performance Report");
    
    const grouped = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.name]) {
        acc[metric.name] = [];
      }
      acc[metric.name].push(metric.duration);
      return acc;
    }, {} as Record<string, number[]>);

    Object.entries(grouped).forEach(([name, durations]) => {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const min = Math.min(...durations);
      const max = Math.max(...durations);
      
      console.log(`${name}:`, {
        count: durations.length,
        avg: `${avg.toFixed(2)}ms`,
        min: `${min.toFixed(2)}ms`,
        max: `${max.toFixed(2)}ms`,
      });
    });
    
    console.groupEnd();
  }
}

export const perfMonitor = new PerformanceMonitor();

// Error tracking
interface ErrorLog {
  message: string;
  stack?: string;
  context?: string;
  timestamp: number;
  userId?: string;
}

class ErrorTracker {
  private errors: ErrorLog[] = [];
  private maxErrors = 100;

  track(error: Error, context?: string, userId?: string) {
    const errorLog: ErrorLog = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now(),
      userId,
    };

    this.errors.push(errorLog);
    
    // Keep only last maxErrors
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    console.error("🔴 Error tracked:", errorLog);

    // In production, send to error tracking service
    if (import.meta.env.PROD) {
      // TODO: Send to Sentry or similar service
      console.error("Production error:", errorLog);
    }
  }

  getErrors() {
    return [...this.errors];
  }

  getRecentErrors(count: number = 10) {
    return this.errors.slice(-count);
  }

  clear() {
    this.errors = [];
  }

  report() {
    console.group("🔴 Error Report");
    console.log(`Total errors: ${this.errors.length}`);
    
    const byContext = this.errors.reduce((acc, err) => {
      const ctx = err.context || "unknown";
      acc[ctx] = (acc[ctx] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log("Errors by context:", byContext);
    console.log("Recent errors:", this.getRecentErrors(5));
    console.groupEnd();
  }
}

export const errorTracker = new ErrorTracker();

// Usage metrics
interface UsageMetric {
  event: string;
  data?: Record<string, any>;
  timestamp: number;
  userId?: string;
}

class UsageTracker {
  private events: UsageMetric[] = [];
  private maxEvents = 500;

  track(event: string, data?: Record<string, any>, userId?: string) {
    const metric: UsageMetric = {
      event,
      data,
      timestamp: Date.now(),
      userId,
    };

    this.events.push(metric);
    
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    console.log(`📍 Event: ${event}`, data);
  }

  getEvents() {
    return [...this.events];
  }

  getEventCount(event: string) {
    return this.events.filter(e => e.event === event).length;
  }

  clear() {
    this.events = [];
  }

  report() {
    console.group("📍 Usage Report");
    
    const eventCounts = this.events.reduce((acc, evt) => {
      acc[evt.event] = (acc[evt.event] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log("Event counts:", eventCounts);
    console.log("Total events:", this.events.length);
    console.groupEnd();
  }
}

export const usageTracker = new UsageTracker();

// Export a combined monitoring object
export const monitoring = {
  performance: perfMonitor,
  errors: errorTracker,
  usage: usageTracker,
  
  reportAll() {
    console.group("📊 Complete Monitoring Report");
    perfMonitor.report();
    errorTracker.report();
    usageTracker.report();
    console.groupEnd();
  },
  
  clearAll() {
    perfMonitor.clear();
    errorTracker.clear();
    usageTracker.clear();
    console.log("✅ All monitoring data cleared");
  },
};

// Make monitoring available globally in development
if (!import.meta.env.PROD) {
  (window as any).monitoring = monitoring;
  console.log("💡 Monitoring tools available via window.monitoring");
}
