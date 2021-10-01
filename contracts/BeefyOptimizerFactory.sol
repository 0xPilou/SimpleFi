// "SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.8.0;

import "./BeefyOptimizer.sol";

contract BeefyOptimizerFactory {

    // Array of addresses of all existing BeefyOptimizer created by the Factory
    address[] public beefyOptimizers;

    // Address of the Treasury
    address public treasury;

    // Array of all the Strategies supported by the BeefyOptimizerFactory
    Strategy[] public strategies;

    // Definition of a Strategy : 
    //  - ID of the strategy
    //  - Beefy Vault contract address
    struct Strategy {
        uint256 poolId;
        address beefyVaultAddr;
    }
    
    // Mapping storing the optimizers addresses of a given user
    mapping(address => address[]) public beefyOptimizerByOwner; 

    // Mapping storing the FeeCollector address of a given Strategy
    mapping(uint256 => address) public feeCollectors; 

    constructor(address _treasury) {
        treasury = _treasury;
    }

    // Create a new strategy
    function addStrategy(
        address _beefyVaultAddr
    ) external returns(uint256){
        // Can only be called by the Treasury contract
        require(msg.sender == treasury);

        Strategy memory newStrategy;

        // Populate the strategy struct with requested parameters
        newStrategy.poolId = strategies.length;
        newStrategy.beefyVaultAddr = _beefyVaultAddr;

        // Add the new strategy to the contract strategies storage  
        strategies.push(newStrategy);

        // Create the first optimizer of this strategy (i.e. the FeeCollector) belonging to the Treasury.
        address feeCollector = this.createBeefyOptimizer(newStrategy.poolId);

        // Transfer the ownership of the FeeCollector Optimizer to the Treasury
        BeefyOptimizer(feeCollector).transferOwnership(msg.sender);

        // Register the optimizer address of the FeeCollector
        feeCollectors[newStrategy.poolId] = feeCollector;

        return newStrategy.poolId;
    }

    // Create an Optimizer for a given strategy (_poolID).
    function createBeefyOptimizer(uint256 _poolId) external returns(address) {
        
        BeefyOptimizer beefyOptimizer = new BeefyOptimizer(
            strategies[_poolId].beefyVaultAddr,
            this.getFeeCollectorByStrategyID(_poolId)
        );
        // Register the newly created optimizer address to the contract storage
        beefyOptimizers.push(address(beefyOptimizer));

        // Register the newly created optimizer address for the given user
        beefyOptimizerByOwner[msg.sender].push(address(beefyOptimizer));

        // Transfer the Optimizer ownership to the user
        beefyOptimizer.transferOwnership(msg.sender);

        return address(beefyOptimizer);
    }


    function getOptimizerCount() external view returns(uint) {
        return beefyOptimizers.length;
    } 
    
    function getStrategyCount() external view returns(uint) {
        return strategies.length;
    }

    function getOwnerOptimizers(address _owner) external view returns(address[] memory) {
        return beefyOptimizerByOwner[_owner];
    }

    function getFeeCollectorByStrategyID(uint256 _poolId) external view returns(address){
        return feeCollectors[_poolId];
    }
}



