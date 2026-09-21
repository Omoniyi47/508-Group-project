export function textractTable(id, rows, { page = 1, confidence = 98 } = {}) {
  const blocks = [];
  const cellIds = [];
  rows.forEach((row, rowIndex) => row.forEach((text, columnIndex) => {
    if (text === null) return; // Missing cells must not shift subsequent columns.
    const cellId = `${id}-r${rowIndex + 1}-c${columnIndex + 1}`;
    const words = String(text).trim() ? String(text).trim().split(/\s+/) : [];
    const wordIds = words.map((word, index) => {
      const wordId = `${cellId}-w${index}`;
      blocks.push({ Id: wordId, BlockType: 'WORD', Text: word, Confidence: confidence, Page: page });
      return wordId;
    });
    blocks.push({ Id: cellId, BlockType: 'CELL', RowIndex: rowIndex + 1, ColumnIndex: columnIndex + 1,
      Confidence: confidence, Page: page, Relationships: [{ Type: 'CHILD', Ids: wordIds }] });
    cellIds.push(cellId);
  }));
  return [{ Id: id, BlockType: 'TABLE', Page: page, Relationships: [{ Type: 'CHILD', Ids: cellIds }] }, ...blocks];
}

export const textractTestConfig = {
  provider: 'amazon_textract',
  textract: { region: 'us-east-1', accessKeyId: 'test-access-key', secretAccessKey: 'test-secret-key', sessionToken: '', bucket: 'test-ocr-bucket', timeoutMs: 10000 },
};
