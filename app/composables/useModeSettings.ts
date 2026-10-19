import { defaultEnabledIds, enabledModesFor, type ChallengeId, type ModeScoringStrategies } from "../data/home-config";
import type { ScoringStrategy } from "../types/competition";
import type { ModeSettingsRepository } from "../storage/contracts";

/**
 * Which challenge modes the home page offers. The team switches them at /modes;
 * until then (or when storage can't be read) the home-config defaults apply.
 * Storage is read after mount, so `loaded` is false during SSR and hydration.
 */
export function useModeSettings(repository: ModeSettingsRepository) {
  const savedIds = ref<ChallengeId[] | undefined>(undefined);
  const strategies = ref<ModeScoringStrategies>({});
  const loaded = ref(false);
  const loadError = ref(false);
  const enabledModes = computed(() => enabledModesFor(savedIds.value, strategies.value));
  const enabledIds = computed(() => enabledModes.value.map((mode) => mode.id));
  const customized = computed(() => savedIds.value !== undefined || Object.keys(strategies.value).length > 0);
  let unsubscribe: (() => void) | undefined;

  function refresh(): void {
    try {
      const ids = repository.enabledIds();
      const scoring = repository.scoringStrategies();
      savedIds.value = ids;
      strategies.value = scoring;
      loadError.value = false;
    } catch {
      savedIds.value = undefined;
      strategies.value = {};
      loadError.value = true;
    }
    loaded.value = true;
  }
  async function setEnabled(id: ChallengeId, enabled: boolean): Promise<void> {
    const next = enabled ? [...enabledIds.value, id] : enabledIds.value.filter((item) => item !== id);
    await repository.save([...new Set(next)]);
    refresh();
  }
  async function reset(): Promise<void> {
    await repository.reset();
    refresh();
  }
  async function setScoringStrategy(id: ChallengeId, strategy: ScoringStrategy): Promise<void> {
    await repository.setScoringStrategy(id, strategy);
    refresh();
  }

  onMounted(() => {
    refresh();
    unsubscribe = repository.subscribe(refresh);
  });
  onBeforeUnmount(() => unsubscribe?.());

  return { enabledModes, enabledIds, strategies, customized, loaded, loadError, setEnabled, setScoringStrategy, reset, defaultEnabledIds };
}
