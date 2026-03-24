function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  let scaled = value;
  while (scaled >= 1024 && unitIndex < units.length - 1) {
    scaled /= 1024;
    unitIndex += 1;
  }
  const digits = scaled >= 100 || unitIndex === 0 ? 0 : scaled >= 10 ? 1 : 2;
  return `${scaled.toFixed(digits)} ${units[unitIndex]}`;
}

function formatDuration(ms) {
  const value = Number(ms || 0);
  if (!Number.isFinite(value)) return "0 ms";
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 2)} s`;
  if (value >= 100) return `${Math.round(value)} ms`;
  if (value >= 10) return `${value.toFixed(1)} ms`;
  return `${value.toFixed(2)} ms`;
}

function formatPercent(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0%";
  return `${numeric.toFixed(numeric >= 10 ? 0 : 1)}%`;
}

function formatRatio(part, whole) {
  const partValue = Number(part || 0);
  const wholeValue = Number(whole || 0);
  if (!wholeValue || wholeValue <= 0) return "0%";
  return formatPercent((partValue / wholeValue) * 100);
}

function formatDateTime(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatHostLabel(value = "") {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "Unknown";
  try {
    const parsed = new URL(trimmed);
    return parsed.host || trimmed;
  } catch {
    return trimmed;
  }
}

function formatUptime(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds || 0)));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days}d ${hours}h ${minutes}m`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds % 60}s`;
}

function compactStorageLabel(label = "") {
  const lookup = {
    "Profile media": "Profiles",
    "Core attachments": "Attachments",
    "Download artifacts": "Downloads",
    "Core logs": "Logs",
  };
  return lookup[label] || label;
}

function MetricCard({ label, value, detail, accent = false }) {
  return (
    <article className={`admin-kpi-card ${accent ? "accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

function UsageBar({ label, value, max, detail }) {
  const numericValue = Number(value || 0);
  const numericMax = Number(max || 0);
  const percent =
    numericMax > 0 ? Math.max(0, Math.min(100, (numericValue / numericMax) * 100)) : 0;

  return (
    <div className="admin-usage-bar">
      <div className="admin-usage-bar-head">
        <span>{label}</span>
        <strong>{detail}</strong>
      </div>
      <div className="admin-usage-bar-track">
        <div className="admin-usage-bar-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function BarChart({ items, valueFormatter, emptyText }) {
  const maxValue = Math.max(...items.map((item) => Number(item.value || 0)), 0);

  if (!items.length || maxValue <= 0) {
    return <p className="text-dim">{emptyText}</p>;
  }

  return (
    <div className="admin-chart-bars">
      {items.map((item) => {
        const value = Number(item.value || 0);
        const percent = value <= 0 ? 0 : Math.max(8, Math.round((value / maxValue) * 100));
        return (
          <div key={item.label} className="admin-chart-bar-col">
            <span className="admin-chart-bar-value">
              {typeof valueFormatter === "function" ? valueFormatter(value) : value}
            </span>
            <div className="admin-chart-bar-track">
              <div
                className="admin-chart-bar-fill"
                style={{
                  height: `${percent}%`,
                  background: item.color || "var(--admin-chart-primary)",
                }}
              />
            </div>
            <span className="admin-chart-bar-label">{item.label}</span>
            {item.detail ? <small>{item.detail}</small> : null}
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({ items, totalLabel, totalValue }) {
  const safeItems = items.filter((item) => Number(item.value || 0) > 0);
  const total = safeItems.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="admin-donut-shell">
      <svg viewBox="0 0 120 120" className="admin-donut-chart" aria-hidden="true">
        <circle
          className="admin-donut-track"
          cx="60"
          cy="60"
          r={radius}
          pathLength="100"
        />
        {safeItems.map((item) => {
          const fraction = Number(item.value || 0) / Math.max(total, 1);
          const dash = fraction * circumference;
          const circle = (
            <circle
              key={item.label}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${Math.max(circumference - dash, 0)}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
            />
          );
          offset += dash;
          return circle;
        })}
      </svg>
      <div className="admin-donut-center">
        <strong>{totalValue}</strong>
        <span>{totalLabel}</span>
      </div>
    </div>
  );
}

function DonutLegend({ items, valueFormatter }) {
  return (
    <div className="admin-donut-legend">
      {items.map((item) => (
        <div key={item.label} className="admin-donut-legend-row">
          <div className="admin-donut-legend-main">
            <span
              className="admin-donut-legend-dot"
              style={{ background: item.color }}
            />
            <span>{item.label}</span>
          </div>
          <strong>
            {typeof valueFormatter === "function"
              ? valueFormatter(item.value)
              : item.value}
          </strong>
        </div>
      ))}
    </div>
  );
}

function StatList({ items }) {
  return (
    <div className="admin-stat-list">
      {items.map((item) => (
        <div key={item.label} className="admin-stat-list-row">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function DetailGrid({ items }) {
  return (
    <div className="admin-detail-grid">
      {items.map((item) => (
        <div key={item.label} className="admin-detail-card">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.detail ? <small>{item.detail}</small> : null}
        </div>
      ))}
    </div>
  );
}

function RouteTable({ title, rows, emptyText }) {
  return (
    <article className="admin-card admin-dashboard-panel">
      <div className="admin-dashboard-panel-head">
        <div>
          <h3>{title}</h3>
          <small>Measured from this running core process.</small>
        </div>
      </div>
      {rows.length ? (
        <div className="admin-users-table-wrap">
          <table className="admin-table admin-dashboard-table">
            <thead>
              <tr>
                <th>Route</th>
                <th>Requests</th>
                <th>Avg</th>
                <th>P95</th>
                <th>Max</th>
                <th>Error rate</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <div className="admin-route-cell">
                      <span className="admin-route-method">{row.method}</span>
                      <code>{row.route}</code>
                    </div>
                  </td>
                  <td>{formatNumber(row.count)}</td>
                  <td>{formatDuration(row.avgMs)}</td>
                  <td>{formatDuration(row.p95Ms)}</td>
                  <td>{formatDuration(row.maxMs)}</td>
                  <td>{formatPercent(row.errorRate)}</td>
                  <td>{formatDateTime(row.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-dim">{emptyText}</p>
      )}
    </article>
  );
}

export function AdminOverviewDashboard({
  adminOverview,
  stats,
  loading,
  onRefresh,
}) {
  const admins = Array.isArray(adminOverview?.admins) ? adminOverview.admins : [];
  const storageRoots = Array.isArray(stats?.storage?.roots) ? stats.storage.roots : [];
  const requests = stats?.requests || null;
  const service = stats?.service || null;
  const memory = service?.memory || null;
  const infrastructure = stats?.infrastructure || null;
  const topStorageRoot = storageRoots[0] || null;
  const supportOpen =
    Number(stats?.database?.supportTicketsOpen || adminOverview?.supportTicketsOpen || 0);
  const supportTotal =
    Number(stats?.database?.supportTicketsTotal || adminOverview?.supportTicketsTotal || 0);
  const boostBadgeMembers =
    Number(stats?.database?.boostBadgeMembers || adminOverview?.boostBadgeMembers || 0);
  const boostStripeMembers =
    Number(stats?.database?.boostStripeMembers || adminOverview?.boostStripeMembers || 0);
  const boostGrantMembers =
    Number(stats?.database?.boostGrantsActive || adminOverview?.activeBoostGrants || 0);

  const requestStatusItems = [
    {
      label: "Successful",
      value: Number(requests?.statusCounts?.success || 0),
      color: "#3bc98f",
    },
    {
      label: "Redirects",
      value: Number(requests?.statusCounts?.redirect || 0),
      color: "#5da6ff",
    },
    {
      label: "Client errors",
      value: Number(requests?.statusCounts?.clientError || 0),
      color: "#f6c356",
    },
    {
      label: "Server errors",
      value: Number(requests?.statusCounts?.serverError || 0),
      color: "#f16a7f",
    },
  ];

  const latencyItems = [
    {
      label: "Average",
      value: Number(requests?.avgMs || 0),
      detail: formatDuration(requests?.avgMs),
      color: "linear-gradient(180deg, #46d6ff, #2f6dff)",
    },
    {
      label: "P95",
      value: Number(requests?.p95Ms || 0),
      detail: formatDuration(requests?.p95Ms),
      color: "linear-gradient(180deg, #66f1bd, #2d9d8a)",
    },
    {
      label: "Max",
      value: Number(requests?.maxMs || 0),
      detail: formatDuration(requests?.maxMs),
      color: "linear-gradient(180deg, #ffb86a, #ff6a52)",
    },
  ];

  const storageItems = storageRoots.slice(0, 4).map((root, index) => ({
    label: compactStorageLabel(root.label),
    value: Number(root.bytes || 0),
    detail: `${formatCompactNumber(root.fileCount)} files`,
    color: [
      "linear-gradient(180deg, #65d6ff, #3975ff)",
      "linear-gradient(180deg, #8ceba6, #39ae7f)",
      "linear-gradient(180deg, #ffcb6b, #f88d43)",
      "linear-gradient(180deg, #f79ad6, #d059c0)",
    ][index % 4],
  }));

  const staffingItems = [
    {
      label: "Admins",
      value: admins.length,
      detail: `${formatNumber(admins.length)} elevated accounts`,
      color: "linear-gradient(180deg, #67c4ff, #2f6dff)",
    },
    {
      label: "Staff",
      value: Number(adminOverview?.staffAssignmentsCount || 0),
      detail: `${formatNumber(adminOverview?.staffAssignmentsCount || 0)} assignments`,
      color: "linear-gradient(180deg, #7af0c8, #2ca77d)",
    },
    {
      label: "Support",
      value: supportOpen,
      detail: `${formatNumber(supportOpen)} open tickets`,
      color: "linear-gradient(180deg, #ffd169, #ff8f4a)",
    },
    {
      label: "Blogs",
      value: Number(adminOverview?.publishedBlogsCount || 0),
      detail: `${formatNumber(adminOverview?.publishedBlogsCount || 0)} published`,
      color: "linear-gradient(180deg, #f7a1d7, #d257b7)",
    },
  ];

  const platformInventory = [
    { label: "Users", value: formatNumber(stats?.database?.users) },
    { label: "Active sessions", value: formatNumber(stats?.database?.activeRefreshSessions) },
    { label: "Servers", value: formatNumber(stats?.database?.servers) },
    { label: "Memberships", value: formatNumber(stats?.database?.memberships) },
    { label: "Friendships", value: formatNumber(stats?.database?.friendships) },
    { label: "DM messages", value: formatNumber(stats?.database?.socialDmMessages) },
    { label: "DM attachments", value: formatNumber(stats?.database?.socialDmAttachments) },
    { label: "Badge definitions", value: formatNumber(stats?.database?.badgeDefinitions) },
    { label: "Boost badge members", value: formatNumber(boostBadgeMembers) },
    { label: "Stripe subscribers", value: formatNumber(boostStripeMembers) },
    { label: "Manual boost grants", value: formatNumber(boostGrantMembers) },
    { label: "Open support tickets", value: formatNumber(supportOpen) },
  ];

  const providerLabel = String(infrastructure?.provider || "Hosted");
  const computeLabel = String(infrastructure?.computeClass || "").trim();
  const operatingSystemLabel = String(infrastructure?.operatingSystem || "").trim();
  const providerClassName = providerLabel.toLowerCase().includes("aws") ? "aws" : "default";
  const deploymentItems = [
    {
      label: "Provider",
      value: providerLabel,
      detail: infrastructure?.stackName
        ? `Stack ${infrastructure.stackName}`
        : `Environment ${String(infrastructure?.environment || "unknown")}`,
    },
    {
      label: "Compute",
      value: computeLabel || "Not set",
      detail: operatingSystemLabel || "Operating system not detected",
    },
    {
      label: "Region",
      value: infrastructure?.region || "Not set",
      detail: infrastructure?.storage?.region
        ? `Storage region ${infrastructure.storage.region}`
        : "Region metadata not configured",
    },
    {
      label: "Operating system",
      value: operatingSystemLabel || "Not set",
      detail: `Runtime ${service?.platform || "unknown"} / ${service?.arch || "unknown"}`,
    },
    {
      label: "Runtime host",
      value: infrastructure?.runtimeHost || service?.hostname || "Unknown",
      detail: `Node ${service?.nodeVersion || "unknown"}`,
    },
    {
      label: "Database",
      value: infrastructure?.database?.provider || "MySQL",
      detail: infrastructure?.database?.host
        ? `${infrastructure.database.host}:${infrastructure.database.port}`
        : "Database host unavailable",
    },
    {
      label: "Object storage",
      value: infrastructure?.storage?.provider || "Local filesystem",
      detail:
        infrastructure?.storage?.bucket ||
        infrastructure?.storage?.endpoint ||
        "No bucket or endpoint configured",
    },
    {
      label: "Public app",
      value: formatHostLabel(infrastructure?.appBaseUrl),
      detail: infrastructure?.appBaseUrl || "App URL unavailable",
    },
  ];

  return (
    <section className="admin-section admin-dashboard">
      <article className="admin-dashboard-hero-card">
        <div className="admin-dashboard-hero-copy">
          <p className="admin-eyebrow">Mission control</p>
          <h2>
            {providerClassName === "aws"
              ? `${computeLabel ? `AWS ${computeLabel}` : "AWS"} platform health at a glance`
              : "Platform health at a glance"}
          </h2>
          <p className="admin-hint">
            The dashboard now leads with health, capacity, support load,
            deployment context, and growth signals so operators can make faster
            decisions without jumping between tabs.
          </p>
        </div>

        <div className="admin-dashboard-hero-side">
          <div className="admin-refresh-meta">
            <span>Last snapshot</span>
            <strong>{formatDateTime(stats?.generatedAt)}</strong>
          </div>
          <div className="admin-chip-row">
            <span className={`admin-provider-pill ${providerClassName}`}>{providerLabel}</span>
            {infrastructure?.region ? (
              <span className="admin-chip">{infrastructure.region}</span>
            ) : null}
            {computeLabel ? <span className="admin-chip">{computeLabel}</span> : null}
            {operatingSystemLabel ? <span className="admin-chip">{operatingSystemLabel}</span> : null}
            <span className="admin-chip">{infrastructure?.storage?.provider || "Storage"}</span>
            <span className="admin-chip">{infrastructure?.database?.provider || "Database"}</span>
          </div>
          <button type="button" onClick={onRefresh} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh dashboard"}
          </button>
        </div>
      </article>

      <div className="admin-kpi-strip">
        <MetricCard
          label="Requests served"
          value={formatNumber(requests?.totalCount)}
          detail={`P95 ${formatDuration(requests?.p95Ms)}`}
          accent
        />
        <MetricCard
          label="Average response"
          value={formatDuration(requests?.avgMs)}
          detail={`${formatNumber(requests?.inFlight)} in flight`}
        />
        <MetricCard
          label="Tracked storage"
          value={formatBytes(stats?.storage?.totalTrackedBytes)}
          detail={topStorageRoot ? `${topStorageRoot.label} leads` : "No tracked roots yet"}
        />
        <MetricCard
          label="Process memory"
          value={formatBytes(memory?.rssBytes)}
          detail={`Heap ${formatBytes(memory?.heapUsedBytes)}`}
        />
        <MetricCard
          label="Platform users"
          value={formatNumber(stats?.database?.users)}
          detail={`${formatNumber(stats?.database?.activeRefreshSessions)} active sessions`}
        />
        <MetricCard
          label="Boost reach"
          value={formatNumber(boostBadgeMembers)}
          detail={`${formatRatio(boostBadgeMembers, stats?.database?.users)} of users`}
          accent
        />
        <MetricCard
          label="Support queue"
          value={formatNumber(supportOpen)}
          detail={`${formatNumber(supportTotal)} total tickets`}
        />
        <MetricCard
          label="Service uptime"
          value={formatUptime(service?.uptimeSec)}
          detail={service ? `${service.nodeVersion} on ${service.hostname}` : "Waiting for stats"}
        />
      </div>

      <div className="admin-dashboard-grid admin-dashboard-grid-enhanced">
        <article className="admin-card admin-dashboard-panel admin-dashboard-panel-wide admin-chart-panel">
          <div className="admin-dashboard-panel-head">
            <div>
              <h3>Control plane snapshot</h3>
              <small>People, support, content, and boost distribution.</small>
            </div>
          </div>

          <div className="admin-insight-grid">
            <div className="admin-insight-card">
              <span>Founder</span>
              <strong>{adminOverview?.founder?.username || "Unassigned"}</strong>
              <small>
                {adminOverview?.founder?.id ? adminOverview.founder.id : "No founder is currently set"}
              </small>
            </div>
            <div className="admin-insight-card">
              <span>Platform admins</span>
              <strong>{formatNumber(admins.length)}</strong>
              <small>{admins.slice(0, 5).map((admin) => admin.username).join(", ") || "No admins loaded"}</small>
            </div>
            <div className="admin-insight-card">
              <span>Boost channels</span>
              <strong>{formatNumber(boostBadgeMembers)}</strong>
              <small>
                Stripe {formatNumber(boostStripeMembers)} / Manual {formatNumber(boostGrantMembers)}
              </small>
            </div>
            <div className="admin-insight-card">
              <span>Support pressure</span>
              <strong>{formatNumber(supportOpen)}</strong>
              <small>{formatNumber(supportTotal)} total tickets tracked</small>
            </div>
          </div>
        </article>

        <article className="admin-card admin-dashboard-panel admin-dashboard-panel-wide admin-chart-panel">
          <div className="admin-dashboard-panel-head">
            <div>
              <h3>Deployment footprint</h3>
              <small>Hosted infrastructure, runtime target, and storage topology.</small>
            </div>
          </div>
          <DetailGrid items={deploymentItems} />
        </article>

        <article className="admin-card admin-dashboard-panel admin-chart-panel">
          <div className="admin-dashboard-panel-head">
            <div>
              <h3>Request health</h3>
              <small>How responses are currently distributed.</small>
            </div>
          </div>
          <div className="admin-chart-split">
            <DonutChart
              items={requestStatusItems}
              totalLabel="Responses"
              totalValue={formatCompactNumber(
                requestStatusItems.reduce((sum, item) => sum + item.value, 0),
              )}
            />
            <DonutLegend
              items={requestStatusItems}
              valueFormatter={(value) => formatNumber(value)}
            />
          </div>
          <p className="admin-note">
            Restarts reset this mix because request timing is tracked in-memory.
          </p>
        </article>

        <article className="admin-card admin-dashboard-panel admin-chart-panel">
          <div className="admin-dashboard-panel-head">
            <div>
              <h3>Latency profile</h3>
              <small>Average, tail, and worst-case response time.</small>
            </div>
          </div>
          <BarChart
            items={latencyItems}
            valueFormatter={(value) => formatDuration(value)}
            emptyText="No latency samples yet."
          />
          <div className="admin-inline-stat-grid">
            <div>
              <span>Route count</span>
              <strong>{formatNumber(requests?.routeCount)}</strong>
            </div>
            <div>
              <span>Sample window</span>
              <strong>{formatNumber(requests?.recentSampleSize)}</strong>
            </div>
          </div>
        </article>

        <article className="admin-card admin-dashboard-panel admin-chart-panel">
          <div className="admin-dashboard-panel-head">
            <div>
              <h3>Storage footprint</h3>
              <small>Which tracked directories are taking the space.</small>
            </div>
          </div>
          <BarChart
            items={storageItems}
            valueFormatter={(value) => formatBytes(value)}
            emptyText="No storage roots are being tracked yet."
          />
        </article>

        <article className="admin-card admin-dashboard-panel admin-chart-panel">
          <div className="admin-dashboard-panel-head">
            <div>
              <h3>Team load</h3>
              <small>Admins, staff coverage, support demand, and content output.</small>
            </div>
          </div>
          <BarChart
            items={staffingItems}
            valueFormatter={(value) => formatNumber(value)}
            emptyText="No staffing signals available yet."
          />
        </article>

        <article className="admin-card admin-dashboard-panel">
          <div className="admin-dashboard-panel-head">
            <div>
              <h3>Runtime pressure</h3>
              <small>Live process and host memory view.</small>
            </div>
          </div>
          <div className="admin-runtime-grid">
            <MetricCard
              label="PID"
              value={service?.pid || "-"}
              detail={`${service?.platform || "-"} / ${service?.arch || "-"}`}
            />
            <MetricCard
              label="CPU cores"
              value={formatNumber(service?.cpuCount)}
              detail={`Load ${Array.isArray(service?.loadAverage) ? service.loadAverage.join(" / ") : "-"}`}
            />
          </div>
          <div className="admin-usage-stack">
            <UsageBar
              label="Process RSS"
              value={memory?.rssBytes}
              max={memory?.systemTotalBytes}
              detail={`${formatBytes(memory?.rssBytes)} of ${formatBytes(memory?.systemTotalBytes)}`}
            />
            <UsageBar
              label="Heap used"
              value={memory?.heapUsedBytes}
              max={memory?.heapTotalBytes}
              detail={`${formatBytes(memory?.heapUsedBytes)} of ${formatBytes(memory?.heapTotalBytes)}`}
            />
            <UsageBar
              label="System memory"
              value={memory?.systemUsedBytes}
              max={memory?.systemTotalBytes}
              detail={`${formatBytes(memory?.systemUsedBytes)} of ${formatBytes(memory?.systemTotalBytes)}`}
            />
          </div>
        </article>

        <article className="admin-card admin-dashboard-panel">
          <div className="admin-dashboard-panel-head">
            <div>
              <h3>Platform inventory</h3>
              <small>High-signal counts across the core database.</small>
            </div>
          </div>
          <StatList items={platformInventory} />
        </article>

        <article className="admin-card admin-dashboard-panel admin-dashboard-panel-wide">
          <div className="admin-dashboard-panel-head">
            <div>
              <h3>Tracked storage details</h3>
              <small>Availability, files, and disk context for each root.</small>
            </div>
          </div>
          {storageRoots.length ? (
            <div className="admin-storage-list">
              {storageRoots.map((root) => (
                <div key={root.id} className="admin-storage-item">
                  <div className="admin-storage-item-head">
                    <strong>{root.label}</strong>
                    <span>{formatBytes(root.bytes)}</span>
                  </div>
                  <div className="admin-storage-item-meta">
                    <code>{root.path}</code>
                    <span>
                      {formatNumber(root.fileCount)} files / {formatNumber(root.directoryCount)} folders
                    </span>
                  </div>
                  <div className="admin-storage-item-meta">
                    <span>{root.exists ? "Available" : "Missing"}</span>
                    {root.diskTotalBytes ? (
                      <span>
                        Disk free {formatBytes(root.diskFreeBytes)} / {formatBytes(root.diskTotalBytes)}
                      </span>
                    ) : (
                      <span>Disk stats unavailable</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-dim">No storage roots are being tracked yet.</p>
          )}
        </article>

        <RouteTable
          title="Slowest endpoints"
          rows={Array.isArray(requests?.slowestRoutes) ? requests.slowestRoutes : []}
          emptyText="No request timing has been collected yet."
        />

        <RouteTable
          title="Busiest endpoints"
          rows={Array.isArray(requests?.busiestRoutes) ? requests.busiestRoutes : []}
          emptyText="Traffic volume will appear after the service handles requests."
        />

        <RouteTable
          title="Error-heavy endpoints"
          rows={Array.isArray(requests?.errorRoutes) ? requests.errorRoutes : []}
          emptyText="No routes with tracked errors yet."
        />
      </div>
    </section>
  );
}
