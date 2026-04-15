// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CertificateNFT
 * @notice On-chain proof-of-transaction NFT for the CarbonCredit marketplace.
 *
 * Every completed marketplace trade (tree or credit) mints an immutable NFT
 * that permanently records the certificate hash and certificate number.
 *
 * The NFT is non-transferable (soul-bound) — it is proof of *your* trade.
 * Only the platform backend (owner / minter) can mint.
 */
contract CertificateNFT is ERC721, Ownable {
    // ── State ────────────────────────────────────────────
    uint256 private _nextTokenId;

    struct CertData {
        string   certificateNumber;  // e.g. CC-TP-20260311-a4f8c2
        bytes32  certificateHash;    // SHA-256 integrity hash
        uint8    certType;           // 1=tree_purchase 2=tree_sale 3=credit_purchase 4=credit_sale
        uint256  timestamp;          // block.timestamp at mint
    }

    mapping(uint256 => CertData) public certData;          // tokenId → data
    mapping(bytes32 => uint256)  public hashToTokenId;      // hash   → tokenId (prevents duplicates)
    mapping(string  => uint256)  public numberToTokenId;    // certNo → tokenId

    // ── Events ───────────────────────────────────────────
    event CertificateMinted(
        uint256 indexed tokenId,
        address indexed recipient,
        string  certificateNumber,
        bytes32 certificateHash,
        uint8   certType
    );

    // ── Errors ───────────────────────────────────────────
    error AlreadyMinted();
    error SoulBound();

    // ── Constructor ──────────────────────────────────────
    constructor() ERC721("CarbonCredit Certificate", "CCC") Ownable(msg.sender) {
        _nextTokenId = 1; // start at 1
    }

    // ── Minting (backend only) ───────────────────────────
    /**
     * @notice Mint a certificate NFT to `recipient`.
     * @param recipient      Wallet address of the certificate holder.
     * @param certNumber     Off-chain certificate number string.
     * @param certHash       SHA-256 integrity hash (as bytes32).
     * @param certType       1 = tree_purchase, 2 = tree_sale, 3 = credit_purchase, 4 = credit_sale
     * @return tokenId       The newly minted token ID.
     */
    function mintCertificate(
        address recipient,
        string  calldata certNumber,
        bytes32 certHash,
        uint8   certType
    ) external onlyOwner returns (uint256 tokenId) {
        // Prevent duplicate minting for the same hash
        if (hashToTokenId[certHash] != 0) revert AlreadyMinted();

        tokenId = _nextTokenId++;
        _safeMint(recipient, tokenId);

        certData[tokenId] = CertData({
            certificateNumber: certNumber,
            certificateHash:   certHash,
            certType:          certType,
            timestamp:         block.timestamp
        });

        hashToTokenId[certHash]       = tokenId;
        numberToTokenId[certNumber]   = tokenId;

        emit CertificateMinted(tokenId, recipient, certNumber, certHash, certType);
    }

    // ── Soul-bound: block transfers ──────────────────────
    /**
     * @dev Override to make the token non-transferable (soul-bound).
     *      Only mint (from == address(0)) is allowed.
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert SoulBound();
        return super._update(to, tokenId, auth);
    }

    // ── View helpers ─────────────────────────────────────
    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    function getCertByHash(bytes32 h) external view returns (CertData memory) {
        uint256 tid = hashToTokenId[h];
        require(tid != 0, "Not found");
        return certData[tid];
    }

    function getCertByNumber(string calldata num) external view returns (CertData memory, uint256 tokenId) {
        tokenId = numberToTokenId[num];
        require(tokenId != 0, "Not found");
        return (certData[tokenId], tokenId);
    }
}
