// src/cli/index.js - Command Line Interface
const readline = require('readline');
const chalk = require('chalk');
const ora = require('ora');
const Table = require('cli-table3');

const WebCrawlerAI = require('../core/crawler');
const logger = require('../utils/logger');
const config = require('../../config');

// Import command handlers
const crawlCommand = require('./commands/crawl');
const searchCommand = require('./commands/search');
const statsCommand = require('./commands/stats');
const exportCommand = require('./commands/export');

class WebCrawlerCLI {
  constructor() {
    this.crawler = null;
    this.rl = null;
    this.spinner = null;
    this.isInteractive = false;
  }

  /**
   * Run CLI with arguments or interactive mode
   */
  async run(args = []) {
    try {
      console.log(chalk.cyan.bold('\n🕷️  Web Crawler AI - Command Line Interface\n'));

      // Initialize crawler
      await this.initializeCrawler();

      if (args.length === 0) {
        // Interactive mode
        await this.runInteractive();
      } else {
        // Command mode
        await this.runCommand(args);
      }

    } catch (error) {
      console.error(chalk.red('❌ CLI Error:'), error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Initialize the crawler
   */
  async initializeCrawler() {
    this.spinner = ora('Initializing Web Crawler AI...').start();
    
    try {
      this.crawler = new WebCrawlerAI({
        maxConcurrency: config.crawler.maxConcurrency,
        maxDepth: config.crawler.maxDepth,
        delay: config.crawler.delay
      });

      await this.crawler.init();
      this.setupCrawlerEvents();
      
      this.spinner.succeed('Web Crawler AI initialized successfully');
    } catch (error) {
      this.spinner.fail('Failed to initialize crawler');
      throw error;
    }
  }

  /**
   * Setup crawler event listeners
   */
  setupCrawlerEvents() {
    this.crawler.on('page-crawled', (data) => {
      if (this.isInteractive) {
        console.log(chalk.green(`✓ Crawled: ${data.title}`));
        console.log(chalk.gray(`  ${data.url}`));
        console.log(chalk.blue(`  Words: ${data.wordCount}, Quality: ${data.quality}%\n`));
      }
    });

    this.crawler.on('crawl-error', (data) => {
      if (this.isInteractive) {
        console.log(chalk.red(`✗ Failed: ${data.url}`));
        console.log(chalk.gray(`  Error: ${data.error}\n`));
      }
    });

    this.crawler.on('crawl-completed', (stats) => {
      if (this.isInteractive) {
        this.displayStats(stats);
      }
    });
  }

  /**
   * Run in interactive mode
   */
  async runInteractive() {
    this.isInteractive = true;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('webcrawler> ')
    });

    console.log(chalk.yellow('Interactive mode started. Type "help" for available commands.\n'));
    
    this.rl.prompt();

    this.rl.on('line', async (line) => {
      const args = line.trim().split(/\s+/);
      const command = args[0];

      if (command === 'exit' || command === 'quit') {
        console.log(chalk.yellow('Goodbye! 👋'));
        this.rl.close();
        return;
      }

      if (command === 'clear') {
        console.clear();
        this.rl.prompt();
        return;
      }

      if (command === '') {
        this.rl.prompt();
        return;
      }

      try {
        await this.executeCommand(args);
      } catch (error) {
        console.error(chalk.red('Command failed:'), error.message);
      }
      
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      console.log(chalk.yellow('\nExiting...'));
      process.exit(0);
    });
  }

  /**
   * Run single command
   */
  async runCommand(args) {
    await this.executeCommand(args);
  }

  /**
   * Execute a command
   */
  async executeCommand(args) {
    const command = args[0];
    const commandArgs = args.slice(1);

    switch (command) {
      case 'crawl':
        await crawlCommand.execute(this.crawler, commandArgs, { interactive: this.isInteractive });
        break;
        
      case 'search':
        await searchCommand.execute(this.crawler, commandArgs, { interactive: this.isInteractive });
        break;
        
      case 'stats':
        await statsCommand.execute(this.crawler, commandArgs, { interactive: this.isInteractive });
        break;
        
      case 'export':
        await exportCommand.execute(this.crawler, commandArgs, { interactive: this.isInteractive });
        break;
        
      case 'import':
        await this.importCommand(commandArgs);
        break;
        
      case 'config':
        await this.configCommand(commandArgs);
        break;
        
      case 'help':
        this.showHelp();
        break;
        
      default:
        console.log(chalk.red(`Unknown command: ${command}`));
        this.showHelp();
    }
  }

  /**
   * Import data command
   */
  async importCommand(args) {
    const filename = args[0] || 'crawler-data.json';
    
    try {
      const fs = require('fs').promises;
      const data = await fs.readFile(filename, 'utf8');
      
      this.spinner = ora(`Importing data from ${filename}...`).start();
      await this.crawler.importData(data);
      
      const stats = this.crawler.getStats();
      this.spinner.succeed(`Imported ${stats.totalPages} pages successfully`);
      
      if (this.isInteractive) {
        this.displayStats(stats);
      }
    } catch (error) {
      if (this.spinner) this.spinner.fail('Import failed');
      throw error;
    }
  }

  /**
   * Configuration command
   */
  async configCommand(args) {
    const action = args[0];
    
    if (action === 'show') {
      console.log(chalk.blue('\n📋 Current Configuration:\n'));
      
      const table = new Table({
        head: ['Setting', 'Value'],
        colWidths: [30, 50]
      });
      
      table.push(
        ['Max Concurrency', this.crawler.maxConcurrency],
        ['Max Depth', this.crawler.maxDepth],
        ['Delay (ms)', this.crawler.delay],
        ['User Agent', this.crawler.userAgent],
        ['Respect Robots.txt', this.crawler.respectRobots ? 'Yes' : 'No']
      );
      
      console.log(table.toString());
    } else if (action === 'set') {
      const setting = args[1];
      const value = args[2];
      
      if (!setting || !value) {
        console.log(chalk.red('Usage: config set <setting> <value>'));
        return;
      }
      
      // Update configuration (simplified)
      switch (setting) {
        case 'maxConcurrency':
          this.crawler.maxConcurrency = parseInt(value);
          break;
        case 'maxDepth':
          this.crawler.maxDepth = parseInt(value);
          break;
        case 'delay':
          this.crawler.delay = parseInt(value);
          break;
        default:
          console.log(chalk.red(`Unknown setting: ${setting}`));
          return;
      }
      
      console.log(chalk.green(`✓ Set ${setting} to ${value}`));
    } else {
      console.log(chalk.red('Usage: config [show|set] [setting] [value]'));
    }
  }

  /**
   * Display crawling statistics
   */
  displayStats(stats) {
    console.log(chalk.blue('\n📊 Crawling Statistics:\n'));
    
    const table = new Table({
      head: ['Metric', 'Value'],
      colWidths: [25, 20]
    });
    
    table.push(
      ['Total Pages', stats.totalPages.toLocaleString()],
      ['Total URLs', stats.totalUrls.toLocaleString()],
      ['Total Words', stats.totalWords.toLocaleString()],
      ['Failed URLs', stats.totalFailed.toLocaleString()],
      ['Unique Domains', stats.uniqueDomains.toLocaleString()],
      ['Average Quality', `${stats.averageQuality}%`],
      ['Success Rate', `${stats.successRate}%`],
      ['Duration', `${stats.duration}s`],
      ['Pages/Second', stats.pagesPerSecond.toFixed(2)]
    );
    
    console.log(table.toString());
    console.log('');
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log(chalk.blue('\n📚 Available Commands:\n'));
    
    const commands = [
      ['crawl <url>', 'Crawl a website starting from the given URL'],
      ['crawl <url> --depth=N', 'Crawl with specific depth limit'],
      ['crawl <url> --no-follow', 'Crawl single page without following links'],
      ['search <query>', 'Search through crawled content'],
      ['search <query> --limit=N', 'Limit search results to N items'],
      ['stats', 'Show crawling statistics'],
      ['stats --detailed', 'Show detailed statistics'],
      ['export [filename]', 'Export crawled data to JSON file'],
      ['import [filename]', 'Import previously crawled data'],
      ['config show', 'Show current configuration'],
      ['config set <setting> <value>', 'Update configuration setting'],
      ['help', 'Show this help message'],
      ['clear', 'Clear the screen (interactive mode)'],
      ['exit', 'Exit the CLI (interactive mode)']
    ];
    
    const table = new Table({
      head: ['Command', 'Description'],
      colWidths: [25, 50]
    });
    
    commands.forEach(([cmd, desc]) => {
      table.push([chalk.cyan(cmd), desc]);
    });
    
    console.log(table.toString());
    
    console.log(chalk.yellow('\n💡 Examples:'));
    console.log(chalk.gray('  webcrawler crawl https://example.com'));
    console.log(chalk.gray('  webcrawler search "artificial intelligence" --limit=5'));
    console.log(chalk.gray('  webcrawler export my-crawl-data.json'));
    console.log(chalk.gray('  webcrawler stats --detailed'));
    console.log('');
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.rl) {
      this.rl.close();
    }
    
    if (this.spinner && this.spinner.isSpinning) {
      this.spinner.stop();
    }
    
    if (this.crawler) {
      await this.crawler.close();
    }
  }

  /**
   * Handle process interruption
   */
  handleInterruption() {
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n\n⚠️  Received interrupt signal...'));
      
      if (this.spinner && this.spinner.isSpinning) {
        this.spinner.stop();
      }
      
      console.log(chalk.yellow('Cleaning up and exiting...'));
      await this.cleanup();
      process.exit(0);
    });
  }
}

// Command execution function for external use
async function run(args) {
  const cli = new WebCrawlerCLI();
  cli.handleInterruption();
  await cli.run(args);
}

module.exports = {
  WebCrawlerCLI,
  run
};