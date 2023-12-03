export enum SortRelation {
  Child,
  Spouse,
  Parent,
  Sibling,
}

export interface SortItem {
  rel: SortRelation;
  order?: number;
}
