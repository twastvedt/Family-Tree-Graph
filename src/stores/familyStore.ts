import { ref } from 'vue';
import { defineStore } from 'pinia';
import settings from '../settings';
import { Tree } from '@/models/Tree';
import { Data } from '@/models/Data';
import { xml, drag, select } from 'd3';
import type { TreeNode } from '@/models/TreeNode';
import { Person } from '@/models/Person';

export const useFamilyStore = defineStore('family', () => {
  const tree = ref<Tree>();

  const ready = (async () => {
    const xmlDoc = await xml(settings.dataPath);
    const data = new Data(xmlDoc);
    tree.value = data.tree;
  })();

  function addDrag(element: TreeNode) {
    if (!element.element) {
      console.error(`No element set on ${element.handle}.`);
      return;
    }

    select(element.element).call(
      drag<SVGElement, unknown>().on(
        'drag',
        (event: d3.D3DragEvent<SVGElement, TreeNode, unknown>) => {
          const startAngle =
            (Math.atan2(event.y - event.dy, event.x - event.dx) * 180) /
            Math.PI;

          const delta =
            (Math.atan2(event.y, event.x) * 180) / Math.PI - startAngle;

          for (const child of element.rotationChildren!) {
            if (child instanceof Person) {
              child.angle += delta;
            }
          }
        },
      ),
    );
  }

  function formatDate(date: Date): string {
    // return DateTime.fromJSDate(date).toLocaleString(DateTime.DATE_FULL);
    return date.getFullYear().toString();
  }

  return { tree, ready, addDrag, formatDate };
});
