/**
 * Jest mock for React Native's Share API.
 */
const Share = {
  share: jest.fn().mockResolvedValue({ action: 'sharedAction' }),
};

export default Share;
