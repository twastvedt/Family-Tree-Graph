import { ref } from 'vue';
import { defineStore } from 'pinia';
import { useSettingsStore } from './settingsStore';
import { Tree, type DateInfo } from '@/models/Tree';
import { Data } from '@/models/Data';
import { xml, drag, select } from 'd3';

export const useFamilyStore = defineStore('family', () => {
  const settings = useSettingsStore();

  const tree = ref<Tree>();

  const ready = (async () => {
    if (settings.settings.dataPath) {
      const xmlDoc = await xml(settings.settings.dataPath);
      const data = new Data(xmlDoc);
      tree.value = data.tree;
    }
  })();

  function loadData(xml: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const errorNode = doc.querySelector('parsererror');
    if (errorNode) {
      throw new Error('Error parsing xml.');
    }

    const data = new Data(doc);
    tree.value = data.tree;
  }

  function addRotateElement(
    element: SVGElement,
    setValue: (delta: number, event: PointerEvent) => void,
    saveValue?: (event: PointerEvent) => void,
  ) {
    select(element).call(
      drag<SVGElement, unknown>()
        .on(
          'drag.rotate',
          (event: d3.D3DragEvent<SVGElement, unknown, unknown>) => {
            const startAngle = Math.atan2(
              event.y - event.dy,
              event.x - event.dx,
            );
            const delta =
              ((Math.atan2(event.y, event.x) - startAngle) * 180) / Math.PI;

            setValue(delta, event.sourceEvent as PointerEvent);
          },
        )
        .on(
          'end.rotate',
          (event: d3.D3DragEvent<SVGElement, unknown, unknown>) => {
            saveValue?.(event.sourceEvent as PointerEvent);
          },
        ),
    );
  }
  function addScaleElement(
    element: SVGElement,
    getDateInfo: () => DateInfo,
    saveValue: () => void,
  ) {
    select(element).call(
      drag<SVGElement, unknown>()
        .on('start.scale', () => {
          getDateInfo().isOverridden = true;
        })
        .on(
          'drag.scale',
          (event: d3.D3DragEvent<SVGElement, unknown, SVGElement>) => {
            const radius = Math.round(Math.sqrt(event.x ** 2 + event.y ** 2));
            const date = tree.value?.timeScale.invert(radius);
            if (date) {
              getDateInfo().date = new Date(date.getFullYear(), 0, 0);
            }
          },
        )
        .on('end.scale', () => {
          saveValue();
          tree.value?.clearEstimates();
          tree.value?.estimate();
        }),
    );
  }

  function formatDate(date: Date): string {
    // return DateTime.fromJSDate(date).toLocaleString(DateTime.DATE_FULL);
    return date.getFullYear().toString();
  }

  return {
    tree,
    ready,
    loadData,
    addRotateElement,
    addScaleElement,
    formatDate,
  };
});
