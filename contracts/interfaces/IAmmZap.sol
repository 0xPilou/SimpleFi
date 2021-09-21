pragma solidity ^0.8.0;

interface IAmmZap {
 
    function zap(
        address _tokenToZap,
        address _tokenA,
        address _tokenB,
        uint256 _amountToZap
    ) external;

    function unzap(
        address _tokenToUnzap,
        address _expectedToken,
        uint256 _amountToUnzap
    ) external;

}