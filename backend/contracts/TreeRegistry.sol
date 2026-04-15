// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TreeRegistry {
    uint256 public nextTreeId;

    struct Tree {
        address owner;
        string metadataURI;
    }

    mapping(uint256 => Tree) public trees;

    event TreeRegistered(uint256 indexed treeId, address indexed owner, string metadataURI);

    function registerTree(string calldata metadataURI) external returns (uint256) {
        uint256 treeId = nextTreeId;
        trees[treeId] = Tree({
            owner: msg.sender,
            metadataURI: metadataURI
        });

        nextTreeId += 1;

        emit TreeRegistered(treeId, msg.sender, metadataURI);
        return treeId;
    }

    function ownerOf(uint256 treeId) external view returns (address) {
        return trees[treeId].owner;
    }

    function getMetadataURI(uint256 treeId) external view returns (string memory) {
        return trees[treeId].metadataURI;
    }
}
