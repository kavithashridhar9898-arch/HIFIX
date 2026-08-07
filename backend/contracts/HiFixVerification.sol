// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title HiFixVerification
 * @dev Immutable Blockchain Verification System for HiFix Platform.
 * Stores ONLY SHA-256 hashes (bytes32) and non-sensitive reference IDs.
 * NEVER stores customer names, phones, addresses, emails, or payment details.
 */
contract HiFixVerification {
    address public owner;

    struct Record {
        bytes32 entityHash;
        string entityType;     // "CERTIFICATE", "INVOICE", "RECEIPT"
        uint256 bookingId;
        uint256 timestamp;
        address registeredBy;
        bool exists;
    }

    // Mapping from SHA-256 hash to Record
    mapping(bytes32 => Record) private records;
    
    // Counter of total registered records
    uint256 public totalRecords;

    // Events
    event RecordRegistered(
        bytes32 indexed entityHash,
        string entityType,
        uint256 indexed bookingId,
        uint256 timestamp,
        address registeredBy
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only contract owner can register records");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Transfer ownership of the contract
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        owner = newOwner;
    }

    /**
     * @dev Register a SHA-256 hash on Polygon
     * @param _hash Cryptographic hash (bytes32) of the JSON payload
     * @param _entityType Record classification ("CERTIFICATE", "INVOICE", "RECEIPT")
     * @param _bookingId System booking reference ID
     */
    function registerRecord(
        bytes32 _hash,
        string calldata _entityType,
        uint256 _bookingId
    ) external onlyOwner returns (bool) {
        require(_hash != bytes32(0), "Invalid zero hash");
        require(!records[_hash].exists, "Hash already registered on-chain");

        records[_hash] = Record({
            entityHash: _hash,
            entityType: _entityType,
            bookingId: _bookingId,
            timestamp: block.timestamp,
            registeredBy: msg.sender,
            exists: true
        });

        totalRecords++;

        emit RecordRegistered(
            _hash,
            _entityType,
            _bookingId,
            block.timestamp,
            msg.sender
        );

        return true;
    }

    /**
     * @dev Verify if a hash is registered and return details
     * @param _hash Cryptographic hash to query
     */
    function verifyHash(bytes32 _hash)
        external
        view
        returns (
            bool exists,
            string memory entityType,
            uint256 bookingId,
            uint256 timestamp,
            address registeredBy
        )
    {
        Record memory rec = records[_hash];
        return (
            rec.exists,
            rec.entityType,
            rec.bookingId,
            rec.timestamp,
            rec.registeredBy
        );
    }

    /**
     * @dev Check existence of a hash
     */
    function isRegistered(bytes32 _hash) external view returns (bool) {
        return records[_hash].exists;
    }
}
