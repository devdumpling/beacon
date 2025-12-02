<script lang="ts">
  import { Chart, Svg, Axis, Bars, Highlight } from "layerchart";
  import { scaleBand, scaleLinear } from "d3-scale";

  // Accept any event-like object with event_name field
  type EventLike = { event_name?: string };
  let { events = [], limit = 5 }: { events?: EventLike[]; limit?: number } = $props();

  // Count events by name and get top N
  const data = $derived.by(() => {
    if (!events || events.length === 0) return [];

    const counts: Record<string, number> = {};

    for (const event of events) {
      if (event?.event_name) {
        counts[event.event_name] = (counts[event.event_name] || 0) + 1;
      }
    }

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  });

  // Only render chart when we have valid data
  const hasData = $derived(data.length > 0);
</script>

<div class="h-48 w-full">
  {#if hasData}
    <Chart
      {data}
      x="count"
      xScale={scaleLinear()}
      y="name"
      yScale={scaleBand().padding(0.2)}
      padding={{ left: 140, bottom: 24, right: 8, top: 8 }}
    >
      <Svg>
        <Axis placement="left" />
        <Axis placement="bottom" />
        <Bars
          class="fill-rp-gold"
          radius={4}
        />
        <Highlight area />
      </Svg>
    </Chart>
  {:else}
    <div class="h-full flex items-center justify-center text-rp-muted">
      No events recorded
    </div>
  {/if}
</div>
