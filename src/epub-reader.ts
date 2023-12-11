import * as fs from 'fs';
import * as path from 'path';
import * as JSZip from 'jszip';
import * as xml2js from 'xml2js';
// import { JSDOM } from 'jsdom';
import * as cheerio from 'cheerio';
import { SpineI, ManifestI, TOCI, XMLI } from './interface';
import { SQLBuilder } from './sqlBuilder';


interface Chapter {
  title: string;
  files: string[];
}
export interface ScrappedContent {
  title: string;
  content: string;
}
export default class EpubReader {
  private filepath:string;
  private sqlBuilder?: SQLBuilder

  constructor (fp: string) {
    this.filepath = fp;
    return this;
  }

  private zip?: JSZip;
  private spine: XMLI<SpineI>[] = [];
  private manifest: XMLI<ManifestI>[] = [];
  private TOC:TOCI[] = []
  private relativePath: string = '';
  private title = '';
  private chapterFiles: Chapter[] = []

  private getChapterfiles() {
    // Iterate through the Table of Contents (TOC)
    for (let i=0; i<this.TOC.length; ++i) {
      const tocItem = this.TOC[i];

      const cleanFileName = tocItem.content[0].$.src.split('#')[0];
      const contentFilePath = path.join(this.relativePath, cleanFileName);

      const chapter: Chapter = {
        title: tocItem.navLabel[0].text[0],
        files: [cleanFileName]
      }

      // Read the content file from the zip
      const manifestIndex = this.manifest.findIndex((item, index) => item.$.href === cleanFileName);

      if(i < this.TOC.length-1){
        const nextTocItem = this.TOC[i+1];
        const cleanNextfile = nextTocItem.content[0].$.src.split('#')[0];

        for (let j=manifestIndex+1; j < this.manifest.length; ++j) {
          if(cleanNextfile === this.manifest[j].$.href){
            break;
          }
          chapter.files.push(this.manifest[j].$.href);
        }
      }

      this.chapterFiles.push(chapter);
    }
  }

  private content: ScrappedContent[] = [];
  
  private extractMainContent(htmlContent: string): string {
    htmlContent = htmlContent.replace(/<script([^>]*)\/>/g, ''); //'<script$1></script>');
    const $ = cheerio.load(htmlContent);

    $('img').each((index, element) => {
      const $element = $(element);
      const srcValue = $element.attr('src');
      if (srcValue) {
        const altValue = $element.attr('alt');
        $element.attr('alt', altValue ? `${srcValue} | ${altValue}` : srcValue);
      }
    });

    // Get the content inside the <div class="main"> (or <body>)
    const mainContent = $('.main').html() || $('body').html() || '';
    // Perform additional cleaning, such as removing the xmlns attribute
    const cleanedContent = this.removeUnnecessaryAttributes(mainContent);
  
    return cleanedContent;
  }

  private removeUnnecessaryAttributes(content: string): string {
                  // Remove xmlns attribute
    return content.replace(/ xmlns="[^"]+"/g, '')
                  // Remove class="koboSpan"
                  .replace(/\sclass="koboSpan"/g, '')
                  // Remove id="kobo.*.*"
                  .replace(/\sid="kobo\.\d+\.\d+"/g, '')
                  // Remove line breaks between tags
                  .replace(/\s+/g, ' ')
                  // Remove extra whitespaces between tags
                  .replace(/\s{2,}/g, ' ')
                  ;
  }

  private async readContentFile(contentFilePath: string): Promise<string | undefined> {
    try {
      const content = await this.zip?.file(contentFilePath)?.async('string');
      return content;
    } catch (error) {
      console.error(`Error reading content file ${contentFilePath}:`, error);
      return undefined;
    }
  }

  private async readSpine(): Promise<void> {
    // Process each item in the spine
    for (const itemRef of this.spine) {
      console.log('----');
      const itemId = itemRef.$.idref;
      const item = this.manifest.find((manifestItem) => manifestItem.$.id === itemId);
      //console.log('Process', itemId, item)
      if (item) {
        const itemHref = item.$.href;
        const itemContent = await this.zip!.file(`${this.relativePath}/${itemHref}`);

        //console.log('Process 2', itemId, itemHref, item)

        if (itemContent) {
          // Process the text content of the item (e.g., extract text, save to file, etc.)
          console.log(`Chapter ${itemId}:\n`, itemContent);
        } else {
          console.error(`Failed to read content of item: ${itemId}`);
        }
      }
      console.log('----');
    }
  }

  private findOpfFile(): string | undefined {
    // Iterate through all files in the zip
    for (const fileName in this.zip!.files) {
      if (fileName.endsWith('.opf')) {
        this.relativePath = path.dirname(fileName);
        return fileName;
      }
    }
    return undefined;
  }

  private async parseOpfFile(opfContent: string): Promise<boolean> {
    try {
      // Parse the OPF content using xml2js
      const parser = new xml2js.Parser();
      const parsedOpf = await parser.parseStringPromise(opfContent);
  
      // Extract metadata
      const metadata = parsedOpf.package.metadata[0];
      this.title = metadata['dc:title'][0]._ as string;
      // this.creator = metadata['dc:creator'].map((item: {_: string, $: any}) => {
      //   return item._ as string;
      // }).join(', ');
  
      // Extract spine information
      this.spine = parsedOpf.package.spine[0].itemref as XMLI<SpineI>[];
  
      // Extract manifest items
      this.manifest = parsedOpf.package.manifest[0].item as XMLI<ManifestI>[];
  
      return true;
    } catch (error) {
      console.error('Error parsing OPF file:', error);
      return false;
    }
  }

  private findTocNcxFile(): string | undefined {
    // Iterate through all files in the zip
    for (const fileName in this.zip!.files) {
      if (fileName.toLowerCase().endsWith('toc.ncx')) {
        return fileName;
      }
    }
    return undefined;
  }

  private async parseTocNcxFile(tocNcxContent: string): Promise<boolean> {
    try {
      // Parse the toc.ncx content using xml2js
      const parser = new xml2js.Parser();
      const parsedTocNcx = await parser.parseStringPromise(tocNcxContent);
  
      // Extract navigation points (chapters) from the navMap
      this.TOC = parsedTocNcx.ncx.navMap[0].navPoint;
  
      return true;
    } catch (error) {
      console.error('Error parsing toc.ncx file:', error);
      return false;
    }
  }

  public async load():Promise<boolean> {
    try {
      // Read the epub file as a buffer
      const epubBuffer = fs.readFileSync(this.filepath);
  
      // Create a JSZip instance
      this.zip = await JSZip.loadAsync(epubBuffer) as JSZip;
  
      // Find the OPF file
      const opfFileName = this.findOpfFile();
      if (!opfFileName) {
        console.error('OPF file not found.');
        return false;
      }
  
      // Read and parse the OPF file
      const opfContent = await this.zip.file(opfFileName)?.async('string');
      if (!opfContent) {
        console.error('Failed to read OPF file.');
        return false;
      }
  
      // Parse the OPF file to identify spine and manifest items
      if(!await this.parseOpfFile(opfContent)){
        return false;
      }

      // console.log('Spine', this.spine, 'Manifest', this.manifest);

      const tocNcxFileName = this.findTocNcxFile();
      if (tocNcxFileName) {
        const tocNcxContent = await this.zip.file(tocNcxFileName)?.async('string');
        if (tocNcxContent) {
          if(!await this.parseTocNcxFile(tocNcxContent)) {
            console.log('Failed getting the TOC.')
            return false
          }
        } else {
          console.error(`Failed to read content of toc.ncx file: ${tocNcxFileName}`);
          return false;
        }
      } else {
        console.error('toc.ncx file not found.');
        return false;
      }
      
      this.getChapterfiles();

      // this.sqlBuilder = new SQLBuilder(this.idNovel, this.title, this.firstChapterNumber+1000);

      return true;
    } catch (error) {
      console.error('Error reading epub file:', error);
      return false;
    }
  }

  public async read(): Promise<boolean> {
    try {
      if (!this.zip) {
        console.error('Epub file not loaded.');
        return false;
      }
  
      // Iterate through the chapters in chapterFiles
      for (const chapter of this.chapterFiles) {
        console.log(` - Processing Chapter ${this.content.length+1}: ${chapter.title}`);

        // Initialize an array to store content for the current chapter
        const chapterContent: string[] = [];
  
        // Iterate through the files in the current chapter
        for (const file of chapter.files) {
          const contentFilePath = path.join(this.relativePath, file);
  
          // Read the content file from the zip
          const content = await this.readContentFile(contentFilePath);
          if (content) {
            // Extract the content inside the <div class="main"> (or <body>)
            const cleanedContent = this.extractMainContent(content);

            // Add the cleaned content to the array
            chapterContent.push(cleanedContent);
          } else {
            console.error(`Failed to read content file: ${contentFilePath}`);
            return false;
          }
        }
        // Join the content for the current chapter into a single string
        const joinedContent = chapterContent.join('\n');

        // Create an SQL statement for the current chapter
        this.content.push({
          title: chapter.title,
          content: joinedContent
        })
      }

      return true;
    } catch (error) {
      console.error('Error reading epub file:', error);
      return false;
    }
  }

  public getTitle(): string {
    return this.title;
  }

  public getContent(): ScrappedContent[] {
    return this.content;
  }
}