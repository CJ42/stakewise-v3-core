import { ethers, waffle } from 'hardhat'
import { Wallet } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import {
  EthVault,
  EthVaultFactory,
  EthKeeper,
  Registry,
  EthVaultFactoryMock,
} from '../typechain-types'
import { ThenArg } from '../helpers/types'
import snapshotGasCost from './shared/snapshotGasCost'
import { expect } from './shared/expect'
import { ethVaultFixture } from './shared/fixtures'

const createFixtureLoader = waffle.createFixtureLoader

describe('EthVaultFactory', () => {
  const maxTotalAssets = parseEther('1000')
  const feePercent = 1000
  const vaultName = 'SW ETH Vault'
  const vaultSymbol = 'SW-ETH-1'
  const validatorsRoot = '0x059a8487a1ce461e9670c4646ef85164ae8791613866d28c972fb351dc45c606'
  const validatorsIpfsHash = '/ipfs/QmfPnyNojfyqoi9yqS3jMp16GGiTQee4bdCXJC64KqvTgc'

  let admin: Wallet, owner: Wallet
  let factory: EthVaultFactory, registry: Registry, keeper: EthKeeper

  let loadFixture: ReturnType<typeof createFixtureLoader>
  let createVault: ThenArg<ReturnType<typeof ethVaultFixture>>['createVault']

  before('create fixture loader', async () => {
    ;[owner, admin] = await (ethers as any).getSigners()
    loadFixture = createFixtureLoader([owner])
  })

  beforeEach(async () => {
    ;({
      ethVaultFactory: factory,
      registry,
      keeper,
      createVault,
    } = await loadFixture(ethVaultFixture))
  })

  it('vault deployment gas', async () => {
    await snapshotGasCost(
      factory
        .connect(admin)
        .createVault(
          maxTotalAssets,
          validatorsRoot,
          feePercent,
          vaultName,
          vaultSymbol,
          validatorsIpfsHash
        )
    )
  })

  it('predicts addresses', async () => {
    // FIXME: for some reason returns 1 instead of 0 when running with coverage
    const currentNonce = await factory.nonces(admin.address)
    let addresses = await factory.computeAddresses(admin.address)
    let expectedVaultAddr = addresses.vault
    let expectedFeesEscrowAddr = addresses.feesEscrow

    let vault = await createVault(
      admin,
      maxTotalAssets,
      validatorsRoot,
      feePercent,
      vaultName,
      vaultSymbol,
      validatorsIpfsHash
    )

    expect(vault.address).to.be.eq(expectedVaultAddr)
    expect(await vault.feesEscrow()).to.be.eq(expectedFeesEscrowAddr)

    expect(await factory.nonces(admin.address)).to.be.eq(currentNonce.add(1))
    addresses = await factory.computeAddresses(admin.address)
    expectedVaultAddr = addresses.vault
    expectedFeesEscrowAddr = addresses.feesEscrow

    vault = await createVault(
      admin,
      maxTotalAssets,
      validatorsRoot,
      feePercent,
      vaultName,
      vaultSymbol,
      validatorsIpfsHash
    )

    expect(vault.address).to.be.eq(expectedVaultAddr)
    expect(await vault.feesEscrow()).to.be.eq(expectedFeesEscrowAddr)

    // measure gas consumption
    const factoryMockFactory = await ethers.getContractFactory('EthVaultFactoryMock')
    const factoryMock = (await factoryMockFactory.deploy(
      await factory.vaultImplementation(),
      registry.address
    )) as EthVaultFactoryMock
    await snapshotGasCost(await factoryMock.getGasCostOfComputeAddresses(admin.address))
  })

  it('creates vault correctly', async () => {
    const addresses = await factory.computeAddresses(admin.address)
    const vaultAddress = addresses.vault
    const feesEscrowAddress = addresses.feesEscrow
    const tx = await factory
      .connect(admin)
      .createVault(
        maxTotalAssets,
        validatorsRoot,
        feePercent,
        vaultName,
        vaultSymbol,
        validatorsIpfsHash
      )
    await expect(tx)
      .to.emit(factory, 'VaultCreated')
      .withArgs(
        admin.address,
        vaultAddress,
        feesEscrowAddress,
        maxTotalAssets,
        validatorsRoot,
        feePercent,
        vaultName,
        vaultSymbol,
        validatorsIpfsHash
      )

    await expect(tx).to.emit(registry, 'VaultAdded').withArgs(factory.address, vaultAddress)

    const ethVault = await ethers.getContractFactory('EthVault')
    const vault = ethVault.attach(vaultAddress) as EthVault
    await expect(
      vault.connect(admin).initialize({
        admin: admin.address,
        feesEscrow: feesEscrowAddress,
        maxTotalAssets,
        validatorsRoot,
        feePercent,
        name: vaultName,
        symbol: vaultSymbol,
        validatorsIpfsHash,
      })
    ).to.revertedWith('Initializable: contract is already initialized')
    expect(await registry.vaults(vaultAddress)).to.be.eq(true)
    expect(await vault.keeper()).to.be.eq(keeper.address)
    expect(await vault.registry()).to.be.eq(registry.address)
    expect(await vault.validatorsRoot()).to.be.eq(validatorsRoot)
    expect(await vault.name()).to.be.eq(vaultName)
    expect(await vault.symbol()).to.be.eq(vaultSymbol)
    expect(await vault.maxTotalAssets()).to.be.eq(maxTotalAssets)
    expect(await vault.feePercent()).to.be.eq(feePercent)
    expect(await vault.version()).to.be.eq(1)
    expect(await vault.implementation()).to.be.eq(await factory.vaultImplementation())
    expect(await vault.admin()).to.be.eq(admin.address)
    expect(await vault.feeRecipient()).to.be.eq(admin.address)
  })
})
