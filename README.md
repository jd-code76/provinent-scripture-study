# Provinent Scripture Study

A comprehensive, feature-rich Bible study web application designed for serious scripture engagement with modern tools. 
The entirety of this project was written using AI tools like [Gab AI](https://gab.ai) and [Lumo](https://lumo.proton.me).
The meaning of "Provinent" is a portmanteau of "providence" and "covenant", each referring to God's divine sovereignty.

Access the site here: [https://provinent.org](https://provinent.org)

## Features

### Core Functionality
- **Multi-Translation Support**: ASV, KJV, GNV, BSB, NET
- **Study Notes**: Full Markdown support with live preview and export capabilities
- **Verse Analysis**: Left-click any verse for analyis of a single verse with a side-by-side view of Strong's concordance (provided by [STEP Bible](https://www.stepbible.org)) and a Hebrew or Greek interlinear Bible (provided by [Bible Hub](https://biblehub.com/interlinear/))
- **Verse Highlighting**: Right-click verses to highlight in one of six different colors for study emphasis
- **Reference Bible**: Use the reference Bible to select from multiple translation options to compare with (NASB 1995, NASB 2020, ASV, KJV, ESV, GNV, BSB, NET, CSB, NIV, NKJV, and NLT); this also sets the translation for Bible Gateway searches and the Verse Analysis popup

### Advanced Features
- **Search Integration**: Built-in [Bible Gateway search](https://www.biblegateway.com/usage/) functionality
- **Data Management**: Import/export highlights, notes, and settings
- **Responsive Design**: Useable on any device with a web browser (desktop recommended for best experience)
- **Dark/Light Mode**: Toggle between dark or light mode
- **Color Themes**: Choose from one of six different color themes

### Study Resources Integration
The sidebar provides organized access to extensive theological resources (Reformed Theology/Calvinism focused) including:
- Online Bible platforms
- Christian doctrine references
- Theological resources
- Podcasts and devotionals
- Study tools and commentaries

## Technical Stack

- **Frontend**: Pure HTML5, CSS3, and Vanilla JavaScript (ES6+)
- **Libraries**: 
  - Marked.js for Markdown processing
  - Font Awesome for icons
- **API**: Bible.helloao.org for scripture text, footnotes, and BSB audio
- **Storage**: LocalStorage for user data persistence
- **Build**: Use the provided scripts for setup and consistency

## Installation

1. Clone or download this repository
2. Serve the files through any web server (no server-side processing required)
3. Open `index.html` in a web browser

## Usage

### Basic Navigation
- Use Prev/Next arrow buttons to navigate passages
- Use "Random Passage" to study from any canon passage of Holy Scripture
- Select specific books/chapters from dropdown menus
- Select a narrator and play audio for any chapter of the Bible in the BSB or KJV translations

### Data Management
- Export/import your highlights and notes via JSON files
- Export notes as Markdown or plain text
- Clear cache or perform complete reset in settings

## Browser Support

- Chrome/Chromium 80+ (only tested on these browsers)
- Firefox 75+
- Safari 13+
- Edge 80+

## Privacy & Data

Highlights, notes, and settings are stored locally in your browser. Data transmitted to external servers:
- Bible passage requests are handled by bible.helloao.org
- Bible Hub (interlinear) and STEP Bible (both when using Verse Analysis popup)
- Bible Gateway searches
- Resource links opened in external sites via the sidebar
- Third-party library usage for Font Awesome and Marked.js

## Attribution

- Scripture text provided by [bible.helloao.org](https://bible.helloao.org) API
- Berean Standard Bible translation by [Berean Bible](https://berean.bible)
- Audio files hosted by [Open Bible](https://openbible.com/audio/)
- Icons by [Font Awesome](https://fontawesome.com)
- Markdown processing by [Marked.js](https://cdn.jsdelivr.net/npm/marked/)

## License

This project is licensed under the [GNU General Public License v3.0 (GPLv3)](https://www.gnu.org/licenses/gpl-3.0.en.html#license-text).

- **Freedom to use**: Anyone can use this software for any purpose
- **Freedom to study**: Anyone can examine how it works and modify it
- **Freedom to distribute**: Anyone can share original or modified versions
- **Copyleft**: All derivative works must remain under GPLv3, preventing commercial proprietary exploitation

## Support

For issues or suggestions, please check the browser console for error messages and ensure you're using a supported browser version.

---

*Soli Deo Gloria*
