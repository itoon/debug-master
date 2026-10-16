import { competitionTime, defaultEnabledIds, enabledModesFor, type ChallengeId } from "../data/home-config";
import type { ModeSettingsRepository } from "../storage/contracts";

/**
 * Which challenge modes the home page offers. The team switches them at /modes;
 * until then (or when storage can't be read) the home-config defaults apply.
 * Storage is read after mount, so `loaded` is false during SSR and hydration.
 */
export function useModeSettings(repository: ModeSettingsRepository) {
  const savedIds = ref<ChallengeId[] | undefined>(undefined);
  const savedDuration = ref<number | undefined>(undefined);
  const loaded = ref(false);
  const loadError = ref(false);
  const durationSec = computed(() => savedDuration.value ?? competitionTime.defaultSeconds);
  const enabledModes = computed(() => enabledModesFor(savedIds.value, savedDuration.value));
  const enabledIds = computed(() => enabledModes.value.map((mode) => mode.id));
  const customized = computed(() => savedIds.value !== undefined || savedDuration.value !== undefined);
  let unsubscribe: (() => void) | undefined;

  function refresh(): void {
    try {
      savedIds.value = repository.enabledIds();
      savedDuration.value = repository.durationSec();
      loadError.value = false;
    } catch {
      savedIds.value = undefined;
      savedDuration.value = undefined;
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
  async function setDuration(seconds: number): Promise<void> {
    await repository.saveDuration(seconds);
    refresh();
  }

  onMounted(() => {
    refresh();
    unsubscribe = repository.subscribe(refresh);
  });
  onBeforeUnmount(() => unsubscribe?.());

  return { enabledModes, enabledIds, durationSec, customized, loaded, loadError, setEnabled, setDuration, reset, defaultEnabledIds };
}
