import * as fs from 'fs';
import * as path from 'path';

interface SQLChapter {
  noChapter: number,
  title: string,
  textOriginal: string  
}
export class SQLBuilder {
  constructor(private idNovel: number, private bookTitle: string, private firstChapterNumber: number){

  }
  private items: SQLChapter[] = [];
  public add(title: string, textOriginal: string): void{
    this.items.push({
      noChapter: this.firstChapterNumber, title, textOriginal
    });
    ++this.firstChapterNumber;
  }
  public getLastChapterNumber(): number {
    return this.firstChapterNumber;
  }
  public getSQL(): string{
    const sqlStatement: string[] = [];

    this.items.forEach((item) => {
      // Escape single quotes in the content
      const escapedContent = item.textOriginal.replace(/'/g, "''");
  
      // Create the SQL statement
      sqlStatement.push(`
INSERT INTO chapters (idNovel, \`no\`, arc, title, textOriginal)
VALUES (${this.idNovel}, ${item.noChapter + 10000}, '${this.bookTitle}', '${item.title}', '${escapedContent}');
      `);
    })
    return sqlStatement.join(`\n`);
  }
  public fileExists(): boolean {
    const sqlFilePath = path.join(__dirname, `../sql/${this.bookTitle}.sql`);
    return fs.existsSync(sqlFilePath);
  }

  public writeFile(): void {
    // Write the SQL content to a file
    const sqlFilePath = path.join(__dirname, `../sql/${this.bookTitle}.sql`);
    fs.writeFileSync(sqlFilePath, this.getSQL(), 'utf-8');
  }
}