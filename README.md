# Provinent Scripture Study

A comprehensive, feature-rich Bible study web application designed for serious scripture engagement with modern tools. 
The entirety of this project was written using AI tools like [Gab AI](https://gab.ai) and [Lumo](https://lumo.proton.me).

Access the site here: [https://provinent.org](https://provinent.org)

## Features

### Core Functionality
- **Multi-Translation Support**: ASV, KJV, GNV, BSB, NET
- **Verse Highlighting**: Right-click verses to highlight in 6 different colors for study emphasis
- **Study Notes**: Full Markdown support with live preview and export capabilities
- **Original Language Tools**: Click any verse for Strong's Concordance data (provided by [STEP Bible](https://www.stepbible.org)) and Greek/Hebrew interlinear analysis (provided by [Bible Hub](https://biblehub.com/interlinear/))
- **Reference Panel**: Side-by-side Bible comparison with multiple translation options (NASB 1995, NASB 2020, ASV, KJV, ESV, GNV, BSB, NET, CSB, NIV, NKJV, and NLT)

### Advanced Features
- **Offline PDF Support**: Upload Berean Standard Bible PDFs for offline reading
- **Search Integration**: Built-in [Bible Gateway search](https://www.biblegateway.com/usage/) functionality
- **Data Management**: Import/export highlights and notes, local storage persistence
- **Responsive Design**: Useable on desktops and tablets, mobile devices work but are not recommended
- **Dark/Light Mode**: Toggle between color themes with multiple accent color options

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
  - PDF.js for PDF rendering
  - Marked.js for Markdown processing
  - Font Awesome for icons
- **API**: Bible.helloao.org for scripture text
- **Storage**: LocalStorage for user data persistence
- **Build**: Use the provided scripts for setup and consistency

## Installation

1. Clone or download this repository
2. Serve the files through any web server (no server-side processing required)
3. Open `index.html` in a web browser

### Optional PDF Import
For an offline Bible:
1. Download a Berean Standard Bible PDF from the provided links
2. Upload via the settings panel
3. Select "Custom PDF" in the reference panel dropdown

## Usage

### Basic Navigation
- Use Prev/Next buttons to navigate passages
- Select specific books/chapters from dropdown menus
- Use "Random Passage" to study from any canon passage of Holy Scripture

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

## Attribution

- Scripture text provided by [bible.helloao.org](https://bible.helloao.org) API
- Berean Standard Bible translation by [Berean Bible](https://berean.bible)
- Icons by Font Awesome
- PDF rendering by [PDF.js](https://cdnjs.com/libraries/pdf.js)
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
