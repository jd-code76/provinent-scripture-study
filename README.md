# Access the site here: [https://provinent.org](https://provinent.org)

# Provinent Scripture Study

A comprehensive, feature-rich Bible study web application designed for serious scripture engagement with modern tools. 
The entirety of this project was written using AI tools like [Gab AI](https://gab.ai) and [Lumo](https://lumo.proton.me).
The meaning of "Provinent" is a portmanteau of "providence" and "covenant", each referring to God's divine sovereignty.

## Features

### Core Functionality
- **Multi-Translation Support**: ASV, BSB, GNV, KJV, NET
- **Study Notes**: Full Markdown support with preview, hotkeys, and export capabilities
- **Verse Analysis**: Left-click any verse for analysis of a single verse with a side-by-side view of Strong's concordance (provided by [STEP Bible](https://www.stepbible.org)) and a Hebrew or Greek interlinear Bible (provided by [Bible Hub](https://biblehub.com/interlinear/))
- **Verse Highlighting**: Right-click to highlight in six colors for study emphasis
- **Reference Bible**: Use the reference Bible to select from multiple translation options to compare with (ASV, BSB, CSB, ESV, GNV, KJV, LSB, NASB 1995, NASB 2020, NET, NIV, NKJV, NLT); this also sets the translation for Bible Gateway searches and the Verse Analysis popup
- **Search Integration**: Built-in [Bible Gateway search](https://www.biblegateway.com/usage/) functionality to search for any word or passage

### Advanced Features
- **Highlights Management**: Search and filter highlighted verses by color/content
- **Keyboard Navigation**: Extensive keyboard shortcuts (F1 to toggle help)
- **Data Portability**: Import/export highlights, notes, and settings
- **Responsive Design**: Optimized for both desktop and mobile devices (desktop is preferred though)
- **Theming**: Dark/light mode with six color themes

## Markdown Keyboard Shortcuts
### Basic Formatting (Ctrl/Cmd + Key)
| Shortcut | Action | Result |
|----------|--------|--------|
| `Ctrl/Cmd + B` | Bold | `**bold text**` |
| `Ctrl/Cmd + I` | Italic | `*italic text*` |
| `Ctrl/Cmd + K` | Link | `[link text](url)` |
| `Ctrl/Cmd + 1` | Heading 1 | `# Heading 1` |
| `Ctrl/Cmd + 2` | Heading 2 | `## Heading 2` |
| `Ctrl/Cmd + 3` | Heading 3 | `### Heading 3` |
| `Ctrl/Cmd + \`` | Code | `` `code` `` |
| `Ctrl/Cmd + Shift + U` | Unordered List | `- List item` |
| `Ctrl/Cmd + Shift + O` | Ordered List | `1. List item` |
| `Ctrl/Cmd + Shift + >` | Blockquote | `> Quote` |

*Note: Works in both Windows (Ctrl) and Mac (Cmd) environments*

## Navigation Keyboard Shortcuts
### Chapter Navigation
| Shortcut | Action |
|----------|--------|
| `Alt + ←` | Previous Chapter |
| `Alt + →` | Next Chapter |
### Book Navigation  
| Shortcut | Action |
|----------|--------|
| `Alt + Shift + ↑` | Previous Book |
| `Alt + Shift + ↓` | Next Book |
### Other Functions
| Shortcut | Action |
|----------|--------|
| `Alt + P` | Play/Pause Audio |
| `Alt + R` | Random Passage |
| `F1` | Show Help Modal |

*Note: Hotkeys can be customized in the settings menu*

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
- Navigate with arrow buttons or dropdown menus
- Use “Random Passage” to study from any canon passage of Holy Scripture
- Select a narrator and play audio for any chapter of the Bible in the BSB or KJV translations
- Press F1 to view or change keyboard shortcuts

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

- Scripture text provided by [AO Lab API](https://bible.helloao.org)
- Berean Standard Bible translation by [Berean Bible](https://berean.bible)
- Audio files hosted by [Open Bible](https://openbible.com/audio/)
- Icons by [Font Awesome](https://fontawesome.com)
- Markdown processing by [Marked.js](https://cdn.jsdelivr.net/npm/marked/)
- **Reference Bible websites**
  - [Bible Gateway](https://www.biblegateway.com)
  - [Bible.com (YouVersion)](https://www.bible.com)
  - [Bible Hub](https://biblehub.com)
  - [STEP Bible](https://www.stepbible.org)
  - [eBible.org](https://ebible.org)
- All copyrights, trademarks, and attributions belong to their respective owners

## License

This project is licensed under the [GNU General Public License v3.0 (GPLv3)](https://www.gnu.org/licenses/gpl-3.0.en.html#license-text).

- **Freedom to use**: Anyone can use this software for any purpose
- **Freedom to study**: Anyone can examine how it works and modify it
- **Freedom to distribute**: Anyone can share original or modified versions
- **Copyleft**: All derivative works must remain under GPLv3, preventing commercial proprietary exploitation

## Support

For issues or suggestions, please check the browser console for error messages and ensure you're using a supported browser version.

**Romans 11:36**
> For from Him and through Him and to Him are all things. To Him be the glory forever. Amen.

---

*Soli Deo Gloria*
