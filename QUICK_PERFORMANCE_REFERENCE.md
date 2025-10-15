# Quick Performance Reference - FineEarn Platform

## 🚀 Performance Utilities Usage Guide

### 1. Debouncing User Input

```typescript
import { useDebounce } from "@/hooks/useDebounce";

const [search, setSearch] = useState("");
const debouncedSearch = useDebounce(search, 500);

useEffect(() => {
  // This only runs 500ms after user stops typing
  performSearch(debouncedSearch);
}, [debouncedSearch]);
```

**Use for:** Search inputs, filter changes, auto-save

---

### 2. Batch Processing

```typescript
import { BatchProcessor } from "@/lib/performance-utils";

// Create batch processor
const batcher = new BatchProcessor(
  async (items) => {
    return await supabase.from("table").insert(items);
  },
  { batchSize: 10, delay: 100 }
);

// Add items (they'll be batched automatically)
await batcher.add({ data: "..." });
```

**Use for:** Multiple notifications, bulk inserts, analytics events

---

### 3. Retry with Exponential Backoff

```typescript
import { retryWithBackoff } from "@/lib/performance-utils";

const result = await retryWithBackoff(
  async () => {
    return await externalAPI.call();
  },
  { maxRetries: 3, initialDelay: 1000 }
);
```

**Use for:** External API calls, payment processors, email services

---

### 4. Memoization

```typescript
import { memoize } from "@/lib/performance-utils";

const expensiveCalculation = memoize(
  (planPrice: number, days: number) => {
    // Heavy calculation here
    return result;
  },
  { maxSize: 100, ttl: 5 * 60 * 1000 }
);
```

**Use for:** Proration calculations, commission calculations, data transformations

---

### 5. TTL Cache

```typescript
import { TTLCache } from "@/lib/performance-utils";

const cache = new TTLCache<string, any>(5 * 60 * 1000); // 5 min

// Set
cache.set("key", data);

// Get (returns undefined if expired)
const data = cache.get("key");
```

**Use for:** API responses, membership plans, user preferences

---

### 6. Performance Monitoring

```typescript
import { performanceMonitor } from "@/lib/performance-utils";

async function processData() {
  const endTimer = performanceMonitor.start("process-data");
  
  try {
    // ... your code
  } finally {
    endTimer(); // Logs if slow (>1s)
  }
  
  // Get stats
  const stats = performanceMonitor.getStats("process-data");
  console.log(stats); // { count, avg, min, max }
}
```

**Use for:** Identifying bottlenecks, monitoring critical paths

---

## 📊 Database Performance

### Using Materialized Views

```typescript
// Instead of complex JOIN queries, use materialized view
const { data } = await supabase
  .from("mv_user_referral_stats" as any)
  .select("*")
  .eq("user_id", userId)
  .single();

// Get platform stats
const { data: stats } = await supabase
  .from("mv_platform_stats" as any)
  .select("*")
  .single();
```

**Benefits:** 95%+ faster than complex queries

### Refresh Materialized Views

```typescript
// Manual refresh (admin only)
await supabase.rpc("refresh_materialized_views");
```

**Automatic refresh:** Every 15 minutes via cron job

---

## 🎯 React Query Best Practices

### Basic Query with Caching

```typescript
import { useQuery } from "@tanstack/react-query";

const { data, isLoading } = useQuery({
  queryKey: ["transactions", userId],
  queryFn: async () => {
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return data;
  },
  staleTime: 5 * 60 * 1000, // Consider fresh for 5 min
});
```

### Pagination

```typescript
const [page, setPage] = useState(1);
const limit = 20;

const { data } = useQuery({
  queryKey: ["transactions", page],
  queryFn: async () => {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    return await supabase
      .from("transactions")
      .select("*", { count: "exact" })
      .range(from, to);
  },
});
```

### Prefetching

```typescript
import { useQueryClient } from "@tanstack/react-query";

function Component() {
  const queryClient = useQueryClient();

  const prefetchPlans = () => {
    queryClient.prefetchQuery({
      queryKey: ["plans"],
      queryFn: fetchPlans,
    });
  };

  return (
    <Button onMouseEnter={prefetchPlans}>
      Upgrade
    </Button>
  );
}
```

---

## 🔧 Component Optimization

### React.memo

```typescript
import { memo } from "react";

const ExpensiveComponent = memo(
  function ExpensiveComponent({ data }: Props) {
    return <div>{/* Complex rendering */}</div>;
  },
  (prev, next) => prev.data.id === next.data.id
);
```

**Use for:** List items, cards, complex components

### Lazy Loading

```typescript
import { lazy, Suspense } from "react";

const HeavyComponent = lazy(() => import("./HeavyComponent"));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <HeavyComponent />
    </Suspense>
  );
}
```

**Use for:** Admin panel, large pages, modals

---

## 📈 Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| Page Load | < 2s | < 3s |
| API Response | < 500ms | < 1s |
| Database Query | < 100ms | < 500ms |
| Bundle Size | < 500KB | < 1MB |
| Cache Hit Rate | > 80% | > 50% |

---

## 🐛 Common Performance Issues

### Issue: Slow Dashboard Load

**Solution:**
1. Check if using materialized views
2. Verify indexes are in place
3. Implement pagination
4. Add React Query caching

### Issue: Search Too Slow

**Solution:**
1. Add debouncing (500ms)
2. Add database indexes
3. Limit result set to 50
4. Use full-text search for large datasets

### Issue: Too Many Re-renders

**Solution:**
1. Wrap with React.memo
2. Use useCallback for functions
3. Use useMemo for expensive calculations
4. Check if props actually changed

### Issue: Large Bundle Size

**Solution:**
1. Lazy load routes
2. Code split admin panel
3. Remove unused dependencies
4. Use dynamic imports

---

## 📋 Performance Checklist

### Before Deployment

- [ ] All lists paginated
- [ ] Search inputs debounced
- [ ] Database indexes created
- [ ] Materialized views refreshed
- [ ] React Query configured
- [ ] Components memoized
- [ ] Routes lazy loaded
- [ ] Bundle analyzed
- [ ] Performance tested (1000+ users)
- [ ] Monitoring configured

### Monthly Review

- [ ] Check slow query log
- [ ] Review cache hit rates
- [ ] Analyze bundle size trends
- [ ] Update indexes if needed
- [ ] Review error rates
- [ ] Check database growth
- [ ] Optimize bottlenecks

---

## 🚨 Performance Alerts

Set up monitoring for:

```typescript
// Alert if page load > 3s
if (pageLoadTime > 3000) {
  alert("SLOW_PAGE_LOAD", { page, time: pageLoadTime });
}

// Alert if API > 1s
if (apiResponseTime > 1000) {
  alert("SLOW_API", { endpoint, time: apiResponseTime });
}

// Alert if cache hit rate < 70%
if (cacheHitRate < 0.7) {
  alert("LOW_CACHE_HIT", { rate: cacheHitRate });
}
```

---

## 📚 Additional Resources

- [Full Performance Guide](./PERFORMANCE_OPTIMIZATION.md)
- [Testing Documentation](./TESTING_DOCUMENTATION.md)
- [Security Audit Report](./SECURITY_AUDIT_REPORT.md)
- [React Query Docs](https://tanstack.com/query/latest)
- [Supabase Performance Tips](https://supabase.com/docs/guides/database/performance)

---

## 💡 Quick Tips

1. **Always paginate** - Never load all records at once
2. **Debounce inputs** - Wait for user to stop typing
3. **Use materialized views** - For complex statistics
4. **Cache aggressively** - Static data shouldn't hit DB repeatedly
5. **Monitor everything** - Can't optimize what you don't measure
6. **Lazy load routes** - Split code by page
7. **Memoize components** - Prevent unnecessary re-renders
8. **Batch operations** - Combine multiple requests
9. **Prefetch data** - Load next page before user clicks
10. **Test with data** - Performance issues appear at scale

---

**Remember:** Premature optimization is the root of all evil, but measured optimization based on real data is the path to success! 🎯
