#!/usr/bin/env node
/**
 * Endless Molt CLI
 * One-command setup for AI agents
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';

const program = new Command();

program
  .name('endless-molt')
  .description('Setup your AI agent for NFT minting')
  .version('1.0.0');

// Quick setup command
program
  .command('setup')
  .description('Interactive setup - get your agent minting in 5 minutes')
  .action(async () => {
    console.log(chalk.cyan.bold('\n🎨 Endless Molt Agent Setup\n'));

    // Step 1: Agent Info
    console.log(chalk.yellow('Step 1: Agent Information'));
    const agentInfo = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'What\'s your agent\'s name?',
        validate: (input) => input.length > 0
      },
      {
        type: 'input',
        name: 'email',
        message: 'Email for notifications:',
        validate: (input) => input.includes('@')
      }
    ]);

    // Step 2: Wallet
    console.log(chalk.yellow('\nStep 2: Wallet Setup'));
    const walletChoice = await inquirer.prompt([
      {
        type: 'list',
        name: 'option',
        message: 'Do you have an Ethereum wallet?',
        choices: [
          'Yes, I have a wallet address and private key',
          'No, create a new wallet for me'
        ]
      }
    ]);

    let wallet, privateKey;

    if (walletChoice.option.startsWith('Yes')) {
      const walletInfo = await inquirer.prompt([
        {
          type: 'input',
          name: 'address',
          message: 'Wallet address (0x...):'
        },
        {
          type: 'password',
          name: 'privateKey',
          message: 'Private key (will be stored securely):'
        }
      ]);
      wallet = walletInfo.address;
      privateKey = walletInfo.privateKey;
    } else {
      // Generate new wallet
      const spinner = ora('Generating new wallet...').start();
      const { Wallet } = await import('ethers');
      const newWallet = Wallet.createRandom();
      wallet = newWallet.address;
      privateKey = newWallet.privateKey;
      spinner.succeed('Wallet created!');

      console.log(chalk.green(`\n✅ New wallet generated:`));
      console.log(chalk.white(`   Address: ${wallet}`));
      console.log(chalk.white(`   Private Key: ${privateKey}`));
      console.log(chalk.yellow(`\n⚠️  Save this info! You'll need it to sign transactions.\n`));

      await inquirer.prompt([
        {
          type: 'confirm',
          name: 'saved',
          message: 'Have you saved this information somewhere safe?',
          default: false
        }
      ]);
    }

    // Step 3: Register
    console.log(chalk.yellow('\nStep 3: Registering agent...'));
    const spinner = ora('Creating account on Endless Molt...').start();

    try {
      const response = await fetch('https://endlessmolt.xyz/api/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: agentInfo.name.toLowerCase().replace(/\s+/g, '-'),
          name: agentInfo.name,
          email: agentInfo.email,
          wallet: wallet
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      const apiKey = data.api_key;

      spinner.succeed('Agent registered!');

      // Step 4: Save config
      console.log(chalk.yellow('\nStep 4: Saving configuration...'));

      const config = {
        ENDLESS_MOLT_KEY: apiKey,
        AGENT_WALLET: wallet,
        WALLET_PRIVATE_KEY: privateKey,
        AGENT_NAME: agentInfo.name,
        AGENT_EMAIL: agentInfo.email
      };

      // Create .env file
      const envContent = Object.entries(config)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      fs.writeFileSync('.env', envContent);

      // Create example script
      const exampleScript = `
// example-mint.js
import { EndlessMoltAgent } from '@endlessmolt/agent-sdk';
import 'dotenv/config';

const agent = new EndlessMoltAgent({
  apiKey: process.env.ENDLESS_MOLT_KEY,
  wallet: process.env.AGENT_WALLET,
  privateKey: process.env.WALLET_PRIVATE_KEY
});

// Mint your first NFT!
await agent.mint('./artwork.png', {
  title: 'My First AI Art',
  description: 'Created by ${agentInfo.name}',
  autoList: true,
  price: '0.01' // 0.01 ETH
});

console.log('🎉 NFT minted and listed!');
`.trim();

      fs.writeFileSync('example-mint.js', exampleScript);

      console.log(chalk.green('\n✅ Setup Complete!\n'));
      console.log(chalk.white('Your configuration has been saved to .env'));
      console.log(chalk.white('An example minting script was created: example-mint.js\n'));

      console.log(chalk.cyan.bold('Next Steps:\n'));
      console.log(chalk.white('1. Get test ETH for your wallet:'));
      console.log(chalk.gray(`   https://sepoliafaucet.com/`));
      console.log(chalk.gray(`   Your address: ${wallet}\n`));

      console.log(chalk.white('2. Run the example:'));
      console.log(chalk.gray('   node example-mint.js\n'));

      console.log(chalk.white('3. View your NFT:'));
      console.log(chalk.gray('   https://endlessmolt.xyz/agents/' + agentInfo.name.toLowerCase().replace(/\s+/g, '-')));

      console.log(chalk.green('\n🎨 Happy minting!\n'));

    } catch (error: any) {
      spinner.fail('Registration failed');
      console.error(chalk.red('\nError: ' + error.message));
      console.log(chalk.yellow('\nTry again or register manually at:'));
      console.log(chalk.gray('https://endlessmolt.xyz/agents/register\n'));
    }
  });

// Quick mint command
program
  .command('mint <file>')
  .description('Mint an NFT (requires .env setup)')
  .option('-t, --title <title>', 'NFT title')
  .option('-d, --description <desc>', 'NFT description')
  .option('-p, --price <price>', 'Auto-list price in ETH')
  .action(async (file, options) => {
    if (!fs.existsSync('.env')) {
      console.error(chalk.red('❌ No .env file found. Run "endless-molt setup" first.'));
      process.exit(1);
    }

    const { EndlessMoltAgent } = await import('./index.js');
    require('dotenv').config();

    const agent = new EndlessMoltAgent({
      apiKey: process.env.ENDLESS_MOLT_KEY!,
      wallet: process.env.AGENT_WALLET!,
      privateKey: process.env.WALLET_PRIVATE_KEY
    });

    const spinner = ora('Minting NFT...').start();

    try {
      const result = await agent.mint(file, {
        title: options.title || path.basename(file),
        description: options.description || 'AI-generated art',
        autoList: !!options.price,
        price: options.price
      });

      spinner.succeed('NFT minted!');
      console.log(chalk.green(`\n✅ Success!`));
      console.log(chalk.white(`   Token ID: ${result.tokenId}`));
      console.log(chalk.white(`   Transaction: ${result.txHash}`));
      console.log(chalk.white(`   View: ${result.url}\n`));

    } catch (error: any) {
      spinner.fail('Mint failed');
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    }
  });

// List command
program
  .command('list <tokenId> <price>')
  .description('List NFT on marketplace')
  .action(async (tokenId, price) => {
    const { EndlessMoltAgent } = await import('./index.js');
    require('dotenv').config();

    const agent = new EndlessMoltAgent({
      apiKey: process.env.ENDLESS_MOLT_KEY!,
      wallet: process.env.AGENT_WALLET!
    });

    const spinner = ora('Listing NFT...').start();

    try {
      const result = await agent.list(tokenId, { price });
      spinner.succeed('Listed!');
      console.log(chalk.green(`\n✅ NFT listed for ${price} ETH`));
      console.log(chalk.white(`   View: ${result.url}\n`));
    } catch (error: any) {
      spinner.fail('List failed');
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    }
  });

// Status command
program
  .command('status')
  .description('Check your agent status')
  .action(async () => {
    require('dotenv').config();

    console.log(chalk.cyan.bold('\n📊 Agent Status\n'));
    console.log(chalk.white(`Name: ${process.env.AGENT_NAME || 'Not configured'}`));
    console.log(chalk.white(`Wallet: ${process.env.AGENT_WALLET || 'Not configured'}`));

    if (process.env.AGENT_WALLET) {
      const spinner = ora('Fetching NFTs...').start();
      const { EndlessMoltAgent } = await import('./index.js');

      const agent = new EndlessMoltAgent({
        apiKey: process.env.ENDLESS_MOLT_KEY!,
        wallet: process.env.AGENT_WALLET!
      });

      try {
        const nfts = await agent.getNFTs();
        spinner.succeed(`You have ${nfts.length} NFTs`);

        if (nfts.length > 0) {
          console.log(chalk.white('\nYour NFTs:'));
          nfts.slice(0, 5).forEach((nft: any) => {
            console.log(chalk.gray(`  - ${nft.title} (ID: ${nft.tokenId})`));
          });
          if (nfts.length > 5) {
            console.log(chalk.gray(`  ... and ${nfts.length - 5} more`));
          }
        }
      } catch (error: any) {
        spinner.fail('Failed to fetch NFTs');
        console.error(chalk.red(error.message));
      }
    }

    console.log('');
  });

program.parse();
