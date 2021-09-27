pragma solidity ^0.8.0;


import 'openzeppelin-solidity/contracts/utils/math/SafeMath.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/utils/SafeERC20.sol';
import 'openzeppelin-solidity/contracts/utils/Context.sol';
import 'openzeppelin-solidity/contracts/access/Ownable.sol';

import "./interfaces/IUniV2Optimizer.sol";
import "./interfaces/IUniV2OptimizerFactory.sol";

contract FeeManager is Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Mapping storing the previous amount of token staked (before dividends payment) of a given Fee Collector
    mapping(address => uint256) public previousFeeCollectorStake;

    function createStrategy(
        address _uniV2OptmizerFactory,
        address _stakingRewardAddr,
        address _uniV2RouterAddr
    ) external onlyOwner {
        IUniV2OptimizerFactory(_uniV2OptmizerFactory).addStrategy(_stakingRewardAddr, _uniV2RouterAddr);
    }

    // Compounds the FeeCollector optimizer and pay the dividends to the stakers
    function compoundFeeCollector(address _feeCollector) external {
        IUniV2Optimizer(_feeCollector).harvest();
        _payDividends(_feeCollector);
    }

    function _payDividends(address _feeCollector) internal {
        uint256 currentStake = IUniV2Optimizer(_feeCollector).staked();
        uint256 previousStake = previousFeeCollectorStake[_feeCollector];

        if(currentStake > previousStake){

            // Dividends are paid in the form of staking LP tokens
            address dividendCurrency = IUniV2Optimizer(_feeCollector).staking();
            
            // The dividends amount correspond to 50% of the yield since the last dividend payment
            uint256 dividends = currentStake.sub(previousStake).div(2);

            // Dividends are withdrawn from the FeeCollector optimizer
            IUniV2Optimizer(_feeCollector).withdraw(dividends);

            // Register the new amount staked 
            previousFeeCollectorStake[_feeCollector] = IUniV2Optimizer(_feeCollector).staked();
            IERC20(dividendCurrency).safeTransfer(0x70997970C51812dc3A010C7d01b50e0d17dc79C8, dividends);
        }
    }
}
