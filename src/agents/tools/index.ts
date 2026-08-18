import { toolCurrentDateTime } from "./current-datetime";
import { toolKnowledgeDocs } from "./knowledge-docs";

export { toolCurrentDateTime, toolKnowledgeDocs };

export const defaultTools = {
    currentDateTime: toolCurrentDateTime(),
    knowledgeDocs: toolKnowledgeDocs(),
};
