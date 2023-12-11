# EPUB Scrapper

I made this to use with my [MTLTools](https://github.com/ssj4maiko/mtltools), but can be adapted to anything.

It searches for the `opf` file (Spine and Manifest), and a `toc.ncx` to get the files related to the chapters. I currently made it for my books bought via kobo, but I noticed it should work with some other epubs too, however, Google Drive exported epubs should be incompatible, since they don't seem to work with these standards.

In case a chapter has multiple `xhtml` files (for example, when an Illustration is given its own page, but there is more text later in the chapter), it deals with that, joining all content into one.

It should be useful if you want to get data from an epub into a simpler format, like a txt file (Although it keeps the HTML), however, right now it includes an SQL Exporter for MTLTools.

## Usage

In MTLTools, you first must create an entry for the Novel (use the driver manual).

Then take note of the **idNovel**.

Now place the EPUBs inside the `books` folder.

When you run the script with `npm start`, it will show the file name, and ask for the **idNovel**, if multiple books are given, you can reuse the previous value by just pressing Enter.

It will then ask what should be the first "chapter number" be. For the exporter, whatever number given will be added by **10000**, so you can decide going from 1 to whatever number, or separate them by `101xx` for Vol 1, `102xx` for Vol 2 and so on, in this case, the input should be `101`, `201`, and double digit volumes would be `1001`, `1101`, `1201`.

But if a continuous numbering is desired, **then the 2nd time will default to next value of the last chapter of the previous book**.

In the `sql/` you will find the SQL files to be imported into the SQL, so you can use whatever method you want to add that. If you get a problem regarding Data truncated with some chapter failing, you may want to use the following queries:

```sql
ALTER TABLE chapters
MODIFY textOriginal MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
MODIFY TextRevision MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
MODIFY textCustom MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE dictionaryEntries
MODIFY entryOriginal TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

I found out a few Kanjis in one of my books were not accepted in normal `utf8` database, which required this extra step.