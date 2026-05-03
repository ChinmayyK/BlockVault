import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

export function useBlockchain() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);

  useEffect(() => {
    const init = async () => {
      if (typeof window.ethereum !== 'undefined') {
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        setProvider(web3Provider);
        
        // You can set up contract here if needed
        // const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS;
        // const contractABI = []; // Your ABI
        // const signer = await web3Provider.getSigner();
        // const contractInstance = new ethers.Contract(contractAddress, contractABI, signer);
        // setContract(contractInstance);
      }
    };
    
    init();
  }, []);

  return { provider, contract };
}



