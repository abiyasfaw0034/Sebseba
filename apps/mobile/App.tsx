import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  ImageBackground,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

const profile = {
  handle: 'Match 24',
  city: 'Addis Ababa',
  distance: '4 km away',
  compatibility: 92,
  reveal: 'Voice opens after both people answer 3 prompts',
  cues: ['Buna conversation', 'Orthodox holidays', 'Ethio-jazz', 'Family stories'],
};

const promptExchange = [
  {
    id: 'song',
    cue: 'Music',
    question: 'Which song belongs in a first date playlist?',
  },
  {
    id: 'table',
    cue: 'Date table',
    question: 'Choose the first date table: buna, tibs, or art walk.',
  },
  {
    id: 'care',
    cue: 'Values',
    question: 'What tradition taught you how to care for people?',
  },
];

const dateSpots = [
  { name: 'Buna corner', detail: 'Quiet tables, hosted introductions', icon: 'coffee-outline' },
  { name: 'Mesob dinner', detail: 'Shared meal with guided prompts', icon: 'food-turkey' },
  { name: 'Art walk', detail: 'Low pressure weekend plan', icon: 'palette-outline' },
];

const matchSignals = [
  { label: 'Shared values', value: 'High' },
  { label: 'Reply rhythm', value: '2 hr' },
  { label: 'Reveal pace', value: 'Slow' },
];

const tabs = [
  { label: 'Match', icon: 'heart-outline' },
  { label: 'Talks', icon: 'chatbubble-ellipses-outline' },
  { label: 'Dates', icon: 'calendar-outline' },
  { label: 'Me', icon: 'person-outline' },
];

export default function App() {
  const [selectedCue, setSelectedCue] = useState(profile.cues[0]);
  const [selectedSpot, setSelectedSpot] = useState(dateSpots[0].name);
  const [selectedPrompt, setSelectedPrompt] = useState(promptExchange[0].id);
  const [answeredPromptIds, setAnsweredPromptIds] = useState<string[]>(['song']);
  const [draft, setDraft] = useState('');
  const { width } = useWindowDimensions();

  const cardWidth = useMemo(() => Math.min(width - 32, 430), [width]);
  const selectedPromptDetail =
    promptExchange.find((prompt) => prompt.id === selectedPrompt) ?? promptExchange[0];
  const answeredCount = answeredPromptIds.length;
  const revealProgress = Math.round((answeredCount / promptExchange.length) * 100);
  const promptsRemaining = promptExchange.length - answeredCount;

  const saveAnswer = () => {
    if (!draft.trim() || answeredPromptIds.includes(selectedPrompt)) {
      return;
    }

    setAnsweredPromptIds((current) => [...current, selectedPrompt]);
    setDraft('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Abiyasfaw</Text>
            <Text style={styles.subtle}>Blind match room</Text>
          </View>
          <Pressable accessibilityLabel="Open notifications" style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={21} color="#1f241f" />
          </Pressable>
        </View>

        <ImageBackground
          source={require('./assets/culture-match.png')}
          imageStyle={styles.heroImage}
          style={[styles.hero, { width: cardWidth }]}
        >
          <View style={styles.heroShade}>
            <View style={styles.heroTop}>
              <View style={styles.statusPill}>
                <Ionicons name="eye-off-outline" size={14} color="#ffffff" />
                <Text style={styles.statusPillText}>Blind profile</Text>
              </View>
              <Text style={styles.fitScore}>{profile.compatibility}%</Text>
            </View>
            <View>
              <Text style={styles.profileName}>{profile.handle}</Text>
              <Text style={styles.profileMeta}>
                {profile.city} - {profile.distance}
              </Text>
            </View>
          </View>
        </ImageBackground>

        <View style={[styles.card, { width: cardWidth }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.kicker}>Reveal progress</Text>
              <Text style={styles.sectionTitle}>
                {promptsRemaining === 0 ? 'Voice reveal is ready' : `${promptsRemaining} prompts left`}
              </Text>
            </View>
            <Ionicons name="mic-outline" size={23} color="#0c5a41" />
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${revealProgress}%` }]} />
          </View>
          <Text style={styles.revealText}>
            {answeredCount}/{promptExchange.length} answered. {profile.reveal}.
          </Text>
          <View style={styles.signalGrid}>
            {matchSignals.map((signal) => (
              <View key={signal.label} style={styles.signalTile}>
                <Text style={styles.signalValue}>{signal.value}</Text>
                <Text style={styles.signalLabel}>{signal.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.card, { width: cardWidth }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.kicker}>Today cue</Text>
              <Text style={styles.sectionTitle}>{selectedCue}</Text>
            </View>
            <MaterialCommunityIcons name="coffee-outline" size={24} color="#0c5a41" />
          </View>

          <View style={styles.cueGrid}>
            {profile.cues.map((cue) => {
              const active = cue === selectedCue;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={cue}
                  onPress={() => setSelectedCue(cue)}
                  style={[styles.cueChip, active && styles.cueChipActive]}
                >
                  <Text style={[styles.cueText, active && styles.cueTextActive]}>{cue}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, { width: cardWidth }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.kicker}>Prompt exchange</Text>
              <Text style={styles.sectionTitle}>Answer before seeing photos</Text>
            </View>
            <Ionicons name="sparkles-outline" size={23} color="#0c5a41" />
          </View>

          {promptExchange.map((prompt, index) => {
            const active = prompt.id === selectedPrompt;
            const answered = answeredPromptIds.includes(prompt.id);
            return (
              <Pressable
                accessibilityRole="button"
                key={prompt.id}
                onPress={() => setSelectedPrompt(prompt.id)}
                style={[styles.promptRow, active && styles.promptRowActive]}
              >
                <View style={[styles.promptIndex, answered && styles.promptIndexDone]}>
                  {answered ? (
                    <Ionicons name="checkmark" size={16} color="#ffffff" />
                  ) : (
                    <Text style={styles.promptIndexText}>{index + 1}</Text>
                  )}
                </View>
                <View style={styles.promptCopy}>
                  <Text style={styles.promptCue}>{prompt.cue}</Text>
                  <Text style={styles.promptText}>{prompt.question}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#667064" />
              </Pressable>
            );
          })}

          <View style={styles.answerBox}>
            <Text style={styles.answerLabel}>{selectedPromptDetail.cue}</Text>
            <TextInput
              multiline
              onChangeText={setDraft}
              placeholder="Write a short answer"
              placeholderTextColor="#7a8377"
              style={styles.answerInput}
              value={draft}
            />
            <Pressable
              accessibilityRole="button"
              disabled={!draft.trim() || answeredPromptIds.includes(selectedPrompt)}
              onPress={saveAnswer}
              style={[
                styles.saveButton,
                (!draft.trim() || answeredPromptIds.includes(selectedPrompt)) && styles.saveButtonDisabled,
              ]}
            >
              <Ionicons name="send-outline" size={17} color="#ffffff" />
              <Text style={styles.saveButtonText}>
                {answeredPromptIds.includes(selectedPrompt) ? 'Saved' : 'Save answer'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, { width: cardWidth }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.kicker}>First date plan</Text>
              <Text style={styles.sectionTitle}>Pick a hosted setting</Text>
            </View>
            <Ionicons name="calendar-outline" size={23} color="#0c5a41" />
          </View>

          {dateSpots.map((spot) => {
            const active = spot.name === selectedSpot;
            return (
              <Pressable
                accessibilityRole="button"
                key={spot.name}
                onPress={() => setSelectedSpot(spot.name)}
                style={[styles.spotRow, active && styles.spotRowActive]}
              >
                <MaterialCommunityIcons
                  name={spot.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                  size={22}
                  color={active ? '#ffffff' : '#0c5a41'}
                />
                <View style={styles.spotCopy}>
                  <Text style={[styles.spotName, active && styles.spotNameActive]}>{spot.name}</Text>
                  <Text style={[styles.spotDetail, active && styles.spotDetailActive]}>{spot.detail}</Text>
                </View>
                {active ? <Ionicons name="checkmark-circle" size={21} color="#f0d478" /> : null}
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.card, { width: cardWidth }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.kicker}>Safety controls</Text>
              <Text style={styles.sectionTitle}>Keep the reveal pace mutual</Text>
            </View>
            <Ionicons name="shield-checkmark-outline" size={24} color="#0c5a41" />
          </View>
          <View style={styles.safetyRow}>
            <View style={styles.safetyIcon}>
              <Ionicons name="lock-closed-outline" size={18} color="#c62b23" />
            </View>
            <Text style={styles.safetyText}>
              Photos stay hidden until both people finish prompts and accept the hosted date plan.
            </Text>
          </View>
          <Pressable accessibilityRole="button" style={styles.reportButton}>
            <Ionicons name="time-outline" size={18} color="#1f241f" />
            <Text style={styles.reportButtonText}>Pause reveal for 24 hours</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.tabBar}>
        {tabs.map((tab, index) => (
          <Pressable key={tab.label} accessibilityRole="button" style={styles.tabItem}>
            <Ionicons
              name={tab.icon as keyof typeof Ionicons.glyphMap}
              size={21}
              color={index === 0 ? '#c62b23' : '#667064'}
            />
            <Text style={[styles.tabText, index === 0 && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f6f1',
  },
  scrollContent: {
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 96,
  },
  header: {
    width: '100%',
    maxWidth: 430,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    color: '#1f241f',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtle: {
    color: '#667064',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(31, 36, 31, 0.1)',
  },
  hero: {
    height: 260,
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#1f241f',
  },
  heroImage: {
    borderRadius: 8,
  },
  heroShade: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(18, 21, 18, 0.28)',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(31, 36, 31, 0.74)',
  },
  statusPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  fitScore: {
    minWidth: 58,
    textAlign: 'center',
    borderRadius: 8,
    overflow: 'hidden',
    paddingVertical: 8,
    color: '#1f241f',
    backgroundColor: '#f0d478',
    fontSize: 17,
    fontWeight: '900',
  },
  profileName: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0,
  },
  profileMeta: {
    color: '#edf1ea',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  card: {
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(31, 36, 31, 0.1)',
    gap: 14,
  },
  sectionHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  kicker: {
    color: '#0c5a41',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#1f241f',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 3,
    maxWidth: 292,
  },
  progressTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: '#e1e7de',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#0c5a41',
  },
  revealText: {
    color: '#3d443c',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  signalGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  signalTile: {
    flex: 1,
    minHeight: 66,
    borderRadius: 8,
    padding: 10,
    justifyContent: 'center',
    backgroundColor: '#f7f9f4',
  },
  signalValue: {
    color: '#1f241f',
    fontSize: 17,
    fontWeight: '900',
  },
  signalLabel: {
    color: '#667064',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    marginTop: 3,
  },
  cueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cueChip: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#edf1ea',
  },
  cueChipActive: {
    backgroundColor: '#0c5a41',
  },
  cueText: {
    color: '#3d443c',
    fontSize: 12,
    fontWeight: '800',
  },
  cueTextActive: {
    color: '#ffffff',
  },
  promptRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#f7f9f4',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  promptRowActive: {
    borderColor: '#0c5a41',
  },
  promptIndex: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0d478',
  },
  promptIndexDone: {
    backgroundColor: '#0c5a41',
  },
  promptIndexText: {
    color: '#1f241f',
    fontSize: 13,
    fontWeight: '900',
  },
  promptCopy: {
    flex: 1,
    gap: 2,
  },
  promptCue: {
    color: '#0c5a41',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  promptText: {
    color: '#2f362f',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  answerBox: {
    borderRadius: 8,
    padding: 12,
    gap: 10,
    backgroundColor: '#edf1ea',
  },
  answerLabel: {
    color: '#0c5a41',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  answerInput: {
    minHeight: 84,
    borderRadius: 8,
    padding: 12,
    color: '#1f241f',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(31, 36, 31, 0.1)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    textAlignVertical: 'top',
  },
  saveButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#c62b23',
  },
  saveButtonDisabled: {
    backgroundColor: '#8d948a',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  spotRow: {
    minHeight: 68,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f7f9f4',
  },
  spotRowActive: {
    backgroundColor: '#0c5a41',
  },
  spotCopy: {
    flex: 1,
  },
  spotName: {
    color: '#1f241f',
    fontSize: 15,
    fontWeight: '900',
  },
  spotNameActive: {
    color: '#ffffff',
  },
  spotDetail: {
    color: '#667064',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 3,
  },
  spotDetailActive: {
    color: '#e7eee6',
  },
  safetyRow: {
    minHeight: 58,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f7f9f4',
  },
  safetyIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(198, 43, 35, 0.1)',
  },
  safetyText: {
    flex: 1,
    color: '#3d443c',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  reportButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#f0d478',
  },
  reportButtonText: {
    color: '#1f241f',
    fontSize: 14,
    fontWeight: '900',
  },
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    maxWidth: 430,
    alignSelf: 'center',
    minHeight: 64,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(31, 36, 31, 0.12)',
  },
  tabItem: {
    width: 68,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabText: {
    color: '#667064',
    fontSize: 11,
    fontWeight: '800',
  },
  tabTextActive: {
    color: '#c62b23',
  },
});
