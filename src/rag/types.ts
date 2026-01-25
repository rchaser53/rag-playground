export type RagItem = {
  id: string;
  title: string;
  content: string;
  source?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
};

export type RagItemCreateInput = {
  title: string;
  content: string;
  source?: string;
  tags?: string[];
};

export type RagItemUpdateInput = {
  title?: string;
  content?: string;
  source?: string;
  tags?: string[];
};
