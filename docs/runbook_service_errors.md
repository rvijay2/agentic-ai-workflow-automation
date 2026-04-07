# Service Error Runbook

## High Error Rate (> 5% error rate)
**Symptoms:** Elevated 5xx responses, increased latency, alert fires
**Root Cause Patterns:**
- Database connection pool exhaustion
- Downstream service timeout
- Memory pressure causing GC pauses

**Mitigation Steps:**
1. Check database connection pool metrics in Grafana
2. Review downstream service health in service mesh dashboard
3. If DB pool exhausted: restart connection pool or scale horizontally
4. If downstream timeout: check circuit breaker status, enable fallback
5. If memory pressure: trigger heap dump, analyze allocations

## Service Crash / OOM
**Symptoms:** Pod restarts, OOMKilled events in Kubernetes
**Root Cause:** Memory leak, traffic spike, misconfigured limits

**Mitigation:**
1. Increase memory limits temporarily (kubectl edit deployment)
2. Enable heap profiling: `export NODE_OPTIONS=--inspect`
3. Collect thread dump and send to on-call engineer
4. Roll back to previous deployment if issue is code-related

## Database Connection Failure
**Symptoms:** `ECONNREFUSED` or `Connection timed out` errors in logs
**Root Cause:** DB host unreachable, credentials expired, network issue

**Mitigation:**
1. Verify DB host is reachable: `telnet db-host 5432`
2. Check credentials in Vault: `vault kv get secret/db/credentials`
3. Check RDS status in AWS console
4. Failover to replica if primary is down

## Deployment Rollback
1. Identify last known good deployment: `kubectl rollout history deployment/api`
2. Rollback: `kubectl rollout undo deployment/api`
3. Monitor error rate for 10 minutes
4. Document incident in incident tracker
