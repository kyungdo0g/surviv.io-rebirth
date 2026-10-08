// Match metrics of the bot overhaul (HARNESS): read-only collectors behind MatchConfig.metrics, summaries over many
// matches, the acceptance thresholds and readable tables. scripts/population.ts runs the suite.
export { METRICS_PROBE, MetricsCollector } from "./collector.ts";
export { formatBreakdown, formatCell, formatGuns, formatRound3, formatThresholds } from "./format.ts";
export { deliberateStats, type Round3Stats, round3Lines, round3Stats } from "./round3Summary.ts";
export type { DeliberateContainers, FragRecord, Round3Bot } from "./round3Types.ts";
export {
    type CellSummary,
    type GroupStats,
    groupStats,
    type MatchSample,
    type Ratio,
    ratio,
    type SuiteMode,
    sampleOf,
    summarizeCell,
} from "./summary.ts";
export { evaluateCell, passed, THRESHOLDS, type ThresholdResult, type Verdict } from "./thresholds.ts";
export type { AirdropRecord, BotMetrics, ChaseEpisode, LoadoutSample, MatchMetrics } from "./types.ts";
