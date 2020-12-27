import * as d3 from 'd3';

export class TreeNode {
  angle: number;
  level: number;
  complete: boolean;

  constructor(public handle: string) {}

  static estimateLifespan(birth: Date, death: Date = undefined): number {
    const interp = d3.scaleLinear().domain([1775, 2019]).range([38, 82]);

    if (birth !== undefined) {
      return interp(birth.getUTCFullYear());
    } else if (death !== undefined) {
      return interp.domain(
        interp.domain().map((d, i) => d + interp.range()[i])
      )(death.getUTCFullYear());
    }
  }
}

export enum Spouse {
  Father,
  Mother,
}
