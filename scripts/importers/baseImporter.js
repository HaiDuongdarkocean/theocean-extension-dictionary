import { putResource, bulkInsertDict, bulkInsertFreq } from "../storage.js";

export class BaseImporter {
  constructor(file, options = {}) {
    this.file = file;
    this.options = options;
    this.resourceId = crypto.randomUUID();
  }

  async import() {
    throw new Error("import() must be implemented in subclass");
  }

  async saveResourceMeta(meta) {
    const resource = {
      id: this.resourceId,
      enabled: true,
      priority: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...meta,
    };
    await putResource(resource);
    return resource;
  }

  async saveDictEntries(entries) {
    await bulkInsertDict(entries);
  }

  async saveFreqEntries(entries) {
    await bulkInsertFreq(entries);
  }
}
