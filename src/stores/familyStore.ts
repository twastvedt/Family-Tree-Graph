import { ref } from 'vue';
import { defineStore } from 'pinia';
import { useSettingsStore } from './settingsStore';
import { Tree } from '@/models/Tree';
import { Data } from '@/models/Data';
import { xml, drag, select } from 'd3';
import type { TreeNode } from '@/models/TreeNode';
import { Person } from '@/models/Person';

export const useFamilyStore = defineStore('family', () => {
  const settings = useSettingsStore();

  const tree = ref<Tree>();

  const ready = (async () => {
    const xmlDoc = await xml(settings.settings.dataPath);
    const data = new Data(xmlDoc);
    tree.value = data.tree;
  })();

  function addRotateNode(element: TreeNode) {
    if (!element.element) {
      console.error(`No element set on ${element.handle}.`);
      return;
    }

    select(element.element).call(
      drag<SVGElement, unknown>()
        .on('drag', (event: d3.D3DragEvent<SVGElement, TreeNode, unknown>) => {
          const startAngle = Math.atan2(event.y - event.dy, event.x - event.dx);

          const delta =
            ((Math.atan2(event.y, event.x) - startAngle) * 180) / Math.PI;

          for (const child of element.rotationChildren) {
            if (child instanceof Person) {
              child.angle += delta;
            }
          }
        })
        .on('end', () => {
          for (const node of element.rotationChildren) {
            if (node instanceof Person) {
              settings.settings.overrides.people[node.handle] = Object.assign(
                settings.settings.overrides.people[node.handle] ?? {},
                {
                  angle: node.angle,
                },
              );
            }
          }
        }),
    );
  }

  function addScaleElement(
    element: SVGElement,
    setYear: (year: number) => void,
    saveValue: () => void,
  ) {
    select(element).call(
      drag<SVGElement, unknown>()
        .on(
          'drag',
          (event: d3.D3DragEvent<SVGElement, unknown, SVGElement>) => {
            if ((event.sourceEvent as PointerEvent).altKey) {
              const radius = Math.round(Math.sqrt(event.x ** 2 + event.y ** 2));
              const date = tree.value?.timeScale.invert(radius);
              if (date) {
                setYear(date.getFullYear());
              }
            }
          },
        )
        .on('end', (event: d3.D3DragEvent<SVGElement, unknown, SVGElement>) => {
          if ((event.sourceEvent as PointerEvent).altKey) {
            saveValue();
          }
        }),
    );
  }

  function formatDate(date: Date): string {
    // return DateTime.fromJSDate(date).toLocaleString(DateTime.DATE_FULL);
    return date.getFullYear().toString();
  }

  return { tree, ready, addRotateNode, addScaleElement, formatDate };
});
