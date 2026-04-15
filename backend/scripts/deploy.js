// scripts/deploy.js
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const [deployer, oracleAccount] = await ethers.getSigners();
  console.log('Deploying from', deployer.address);

  // For local development, the second account will be the oracle
  // In production, use a dedicated oracle private key from environment
  const issuerOracle = oracleAccount ? oracleAccount.address : deployer.address;
  console.log('Issuer Oracle:', issuerOracle);

  // ============================================================
  // 1. Deploy TreeRegistry
  // ============================================================
  const TreeRegistry = await ethers.getContractFactory('TreeRegistry');
  const tree = await TreeRegistry.deploy();
  await tree.deployed();
  console.log('TreeRegistry deployed to:', tree.address);

  // ============================================================
  // 2. Deploy CarbonCredit (oracle-controlled)
  // Args: TreeRegistry address, issuer oracle address
  // ============================================================
  const CarbonCredit = await ethers.getContractFactory('CarbonCredit');
  const credit = await CarbonCredit.deploy(tree.address, issuerOracle);
  await credit.deployed();
  console.log('CarbonCredit deployed to:', credit.address);
  console.log('  - TreeRegistry:', tree.address);
  console.log('  - IssuerOracle:', issuerOracle);

  // ============================================================
  // 3. Deploy CertificateNFT (soul-bound ERC-721)
  // ============================================================
  const CertificateNFT = await ethers.getContractFactory('CertificateNFT');
  const certNft = await CertificateNFT.deploy();
  await certNft.deployed();
  console.log('CertificateNFT deployed to:', certNft.address);

  // ============================================================
  // 4. Save artifacts to backend/deployed
  // ============================================================
  const contractsDir = join(__dirname, '..', 'deployed');
  if (!fs.existsSync(contractsDir)) fs.mkdirSync(contractsDir);

  // TreeRegistry
  fs.writeFileSync(
    join(contractsDir, 'TreeRegistry-address.json'),
    JSON.stringify({ address: tree.address }, null, 2)
  );
  const treeArtifact = await artifacts.readArtifact('TreeRegistry');
  fs.writeFileSync(
    join(contractsDir, 'TreeRegistry-abi.json'),
    JSON.stringify(treeArtifact.abi, null, 2)
  );

  // CarbonCredit
  fs.writeFileSync(
    join(contractsDir, 'CarbonCredit-address.json'),
    JSON.stringify({ 
      address: credit.address,
      issuerOracle: issuerOracle
    }, null, 2)
  );
  const creditArtifact = await artifacts.readArtifact('CarbonCredit');
  fs.writeFileSync(
    join(contractsDir, 'CarbonCredit-abi.json'),
    JSON.stringify(creditArtifact.abi, null, 2)
  );

  // CertificateNFT
  fs.writeFileSync(
    join(contractsDir, 'CertificateNFT-address.json'),
    JSON.stringify({ address: certNft.address }, null, 2)
  );
  const certArtifact = await artifacts.readArtifact('CertificateNFT');
  fs.writeFileSync(
    join(contractsDir, 'CertificateNFT-abi.json'),
    JSON.stringify(certArtifact.abi, null, 2)
  );

  // Save oracle private key to .env.example for development
  // In production, set ORACLE_PRIVATE_KEY manually
  if (oracleAccount) {
    console.log('\n⚠️  DEVELOPMENT: Use Account #1 as Oracle');
    console.log('   Add to backend/.env:');
    console.log('   ORACLE_PRIVATE_KEY=<hardhat account 1 private key>');
    console.log('\n   For Hardhat default accounts, Account #1 private key is:');
    console.log('   0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
  }

  // ============================================================
  // 5. Copy artifacts to frontend/src/contracts
  // ============================================================
  const frontendContractsDir = join(__dirname, '..', '..', 'frontend', 'src', 'contracts');
  if (!fs.existsSync(frontendContractsDir)) fs.mkdirSync(frontendContractsDir, { recursive: true });

  // TreeRegistry
  fs.copyFileSync(
    join(contractsDir, 'TreeRegistry-address.json'),
    join(frontendContractsDir, 'TreeRegistry-address.json')
  );
  fs.copyFileSync(
    join(contractsDir, 'TreeRegistry-abi.json'),
    join(frontendContractsDir, 'TreeRegistry-abi.json')
  );

  // CarbonCredit
  fs.copyFileSync(
    join(contractsDir, 'CarbonCredit-address.json'),
    join(frontendContractsDir, 'CarbonCredit-address.json')
  );
  fs.copyFileSync(
    join(contractsDir, 'CarbonCredit-abi.json'),
    join(frontendContractsDir, 'CarbonCredit-abi.json')
  );

  // CertificateNFT
  fs.copyFileSync(
    join(contractsDir, 'CertificateNFT-address.json'),
    join(frontendContractsDir, 'CertificateNFT-address.json')
  );
  fs.copyFileSync(
    join(contractsDir, 'CertificateNFT-abi.json'),
    join(frontendContractsDir, 'CertificateNFT-abi.json')
  );

  console.log('\n✓ Artifacts saved to backend/deployed/ and frontend/src/contracts/');
  console.log('\n=== Deployment Summary ===');
  console.log('TreeRegistry:', tree.address);
  console.log('CarbonCredit:', credit.address);
  console.log('CertificateNFT:', certNft.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
