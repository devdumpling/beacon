<script lang="ts">
  import { Chart, Svg, Axis, Area, Spline, Highlight } from "layerchart";
  import { scaleTime, scaleLinear } from "d3-scale";
  import { curveMonotoneX } from "d3-shape";

  // Accept any event-like object with timestamp field
  type EventLike = { timestamp?: number };
  let { events = [], days = 7 }: { events?: EventLike[]; days?: number } = $props();

  // Aggregate events by day
  const data = $derived.by(() => {
    const now = Date.now();
    const counts: Record<string, number> = {};

    // Initialize all days with 0
    for (let i = days - 1; i >= 0; i--) {
      const d = now - i * 24 * 60 * 60 * 1000;
      const dateStr = new Date(d).toISOString().split("T")[0];
      counts[dateStr] = 0;
    }

    // Count events per day (only if events exist)
    if (events && events.length > 0) {
      for (const event of events) {
        if (event?.timestamp) {
          const dateStr = new Date(event.timestamp).toISOString().split("T")[0];
          if (dateStr in counts) {
            counts[dateStr]++;
          }
        }
      }
    }

    // Convert to array format for chart
    return Object.entries(counts).map(([dateStr, count]) => ({
      date: new Date(dateStr),
      count,
    }));
  });

  // Pre-compute scales with proper domains
  const xScale = $derived.by(() => {
    if (data.length === 0) return scaleTime();
    const dates = data.map(d => d.date);
    return scaleTime().domain([dates[0], dates[dates.length - 1]]);
  });

  const yScale = $derived.by(() => {
    const maxCount = Math.max(1, ...data.map(d => d.count));
    return scaleLinear().domain([0, maxCount]);
  });

  const hasData = $derived(data.length > 0);
</script>

<div class="h-48 w-full">
  {#if hasData}
    <Chart
      {data}
      x="date"
      {xScale}
      y="count"
      {yScale}
      yNice
      padding={{ left: 40, bottom: 24, right: 8, top: 8 }}
    >
      <Svg>
        <Axis placement="left" grid={{ class: "stroke-rp-overlay" }} />
        <Axis
          placement="bottom"
          format={(d) => {
            const date = d as Date;
            return `${date.getMonth() + 1}/${date.getDate()}`;
          }}
        />
        <Area
          line={{ class: "stroke-2 stroke-rp-iris" }}
          class="fill-rp-iris/20"
          curve={curveMonotoneX}
        />
        <Spline class="stroke-2 stroke-rp-iris" curve={curveMonotoneX} />
        <Highlight points={{ class: "fill-rp-iris" }} lines />
      </Svg>
    </Chart>
  {:else}
    <div class="h-full flex items-center justify-center text-rp-muted">
      No data available
    </div>
  {/if}
</div>
