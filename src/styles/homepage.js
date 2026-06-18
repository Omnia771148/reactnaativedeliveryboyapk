import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6', // Default page background color
  },
  safeArea: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCD5C7', // Sand/Beige header bar background
    height: 54,
    borderRadius: 27,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  headerCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000000', // Black circle for golden logo background
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLogo: {
    width: 24,
    height: 24,
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 36, // Offsets the left circle width to ensure exact centering
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    fontStyle: 'italic',
    color: '#2A3037', // Dark slate gray/blue color
    letterSpacing: 2,
  },
  headerSpacer: {
    // Spacer for flex layout balancing
  },
  gap: {
    height: 16, // Small gap directly under the heading bar
  },
  toggleWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  // Custom Motion Toggle Styles
  toggleClickable: {
    width: 190,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#E55B49', // Default Red/Inactive background color
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  toggleBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 29,
    width: '100%',
    height: '100%',
  },
  toggleActiveBg: {
    backgroundColor: '#2EBD6B', // Vibrant green active background color
  },
  toggleInactiveBg: {
    backgroundColor: '#E55B49', // Red inactive background color
  },
  toggleCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF', // Solid white sliding circle indicator
    position: 'absolute',
    top: 7, // Vertically centered (58 height - 44 height) / 2
    left: 0, // Explicit left start for consistent horizontal sliding
  },
  toggleText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1.5,
    position: 'absolute',
    top: 17, // Vertically centered
  },
  openText: {
    left: 28,
  },
  closedText: {
    right: 28,
  },
  toggleDisabled: {
    opacity: 0.6,
  },
  buttonLoaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bodyContainer: {
    flex: 1,
    backgroundColor: '#FAF9F6',
    paddingHorizontal: 16,
    paddingTop: 24,
    gap: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  halfCard: {
    flex: 1,
    backgroundColor: '#EAE5D9', // Matching the warm sand/beige tone
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  fullCard: {
    backgroundColor: '#EAE5D9',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 16,
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2A3037',
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  cardValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
  },
  monthlyRecordTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2A3037',
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  monthlyDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  monthlyCol: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
  },
  verticalDivider: {
    width: 1.5,
    height: 48,
    backgroundColor: '#C4B295',
  },
});
