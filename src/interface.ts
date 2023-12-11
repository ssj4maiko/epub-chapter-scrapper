export interface XMLI<T> {
  '$': T
}
export interface SpineI {
  idref: string;
}

export interface ManifestI {
  href: string;
  'media-type': string;
  id: string;
  properties?: string;
}

export interface TOCI {
  navLabel: { text: string[]}[];
  content: XMLI<{
    src: string
  }>[];
}