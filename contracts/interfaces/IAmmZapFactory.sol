pragma solidity ^0.8.0;

interface IAmmZapFactory {

    function createAmmZap(
        address _ammRouterAddr
    ) external onlyOwner returns(address newAmmZap);

    function getAmmZapByRouter(
        address _ammRouterAddr
    ) external view returns(address);

    function getAmmZapCount() external view returns(uint);
}

