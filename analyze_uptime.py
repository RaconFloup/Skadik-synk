import json
from datetime import datetime, timezone

with open(r'C:\Users\rarit\Documents\0WorkSpace\Server\.GIT\Skadik-synk\tmp_uptime.json') as f:
    data = json.load(f)

# Netherlands (index 0), Poland (index 1)
for idx, name in [(0, 'Netherlands'), (1, 'Poland')]:
    m = data[idx]
    checks = m['recent_checks']
    print(f"=== {name} ===")
    print(f"  Total checks: {len(checks)}")
    print(f"  First: {checks[0]['checked_at']}")
    print(f"  Last:  {checks[-1]['checked_at']}")
    downs = [c for c in checks if not c['is_up']]
    print(f"  Down: {len(downs)}")
    
    # Find all gaps > 180s
    print(f"  Gaps > 3min:")
    for i in range(1, len(checks)):
        prev = datetime.fromisoformat(checks[i-1]['checked_at'].replace('Z', '+00:00'))
        curr = datetime.fromisoformat(checks[i]['checked_at'].replace('Z', '+00:00'))
        gap = (curr - prev).total_seconds()
        if gap > 180:
            print(f"    {gap:.0f}s gap at {prev} -> {curr}")
    print()
