import * as fs from 'fs';
import * as path from 'path';
import * as readlineSync from 'readline-sync';
import EpubReader from './epub-reader';
import { SQLBuilder } from './sqlBuilder';


async function processEpubsInFolder(folderPath: string): Promise<void> {
  let previousIdNovel: number | undefined;
  let lastChapterNumber: number | undefined;
  try {
    // Read all files in the folder
    const files = fs.readdirSync(folderPath);

    // Process each file in the folder
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      console.log('-----');
      // Check if it's an epub file
      if (filePath.endsWith('.epub')) {
        // Prompt for idNovel and First Chapter Number
        let idNovelInput: string;
        let idNovel: number | undefined;

        while(true){
          idNovelInput = readlineSync.question(
            `Enter idNovel for ${file}${previousIdNovel ? `(press Enter to reuse the previous value (${previousIdNovel}))` : ''}: `,
          );

          idNovel = idNovelInput.trim() ? parseInt(idNovelInput, 10) : previousIdNovel;
          if(idNovel){
            break;
          }
        }
        let firstChapterNumberInput: string;
        let firstChapterNumber: number | undefined;

        while(true){
          firstChapterNumberInput = readlineSync.question(`Enter First Chapter Number for ${file}${lastChapterNumber ? `(press Enter to use the previous value (${lastChapterNumber}))` : ''}: `);

          firstChapterNumber = firstChapterNumberInput.trim() ? parseInt(firstChapterNumberInput, 10) : lastChapterNumber;

          if(firstChapterNumber){
            break;
          }
        }

        console.log(`Processing epub file: ${filePath}`);
        const epub = new EpubReader(filePath);
        if ( await epub.load() ) {
          if ( await epub.read() ) {

            const sqlBuilder = new SQLBuilder(idNovel, epub.getTitle(), firstChapterNumber);
            epub.getContent().forEach( chapter => {
              sqlBuilder.add(chapter.title, chapter.content);
            })
            let doWrite = true;
            if(sqlBuilder.fileExists()){
              while (true) {
                const answer = readlineSync.question('The file already exists. Do you want to overwrite it? (Y/N) [Default: Y]');
                
                if (answer.toUpperCase() === 'Y' || answer.trim() === '') {
                  doWrite = true;
                  break;
                } else if (answer.toUpperCase() === 'N') {
                  doWrite = false;
                  break;
                } else {
                  console.log('Invalid answer. Please enter Y for Yes, N for No, or leave it blank for Yes.');
                }
              }
            }
            if(doWrite) {
              console.log('-----');
              sqlBuilder.writeFile();
            }

            // Store last chapter number, so if the books are sequential, it can just resume from where it stopped.
            lastChapterNumber = sqlBuilder.getLastChapterNumber();

          }
        }

        // Store the current idNovel as the previousIdNovel for the next iteration
        previousIdNovel = idNovel;
      }
    }
  } catch (error) {
    console.error('Error reading folder:', error);
  }
}

// Example usage
const booksFolderPath = path.join(__dirname, '../books');
processEpubsInFolder(booksFolderPath);
