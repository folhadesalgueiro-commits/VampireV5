import { Campaign, Character, Content } from "../shared/model";
export type State = {
  characters: (Character & { derived: any; canEdit: boolean; isGM: boolean })[];
  content: (Content & { canEdit: boolean })[];
  campaigns: (Campaign & { canEdit: boolean; isGM: boolean })[];
  coteries: any[];
  records: any[];
};
export type PageProps = {
  state: State;
  refresh: () => Promise<void>;
  notify: (s: string) => void;
  user: { id: string; name: string; role: string };
  go: (page: string, id?: string) => void;
};
