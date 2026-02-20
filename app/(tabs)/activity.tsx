import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../src/constants/colors';
import { useAuth } from '../../src/contexts/AuthContext';
import { fetchMyDebts, subscribeToAllDebts } from '../../src/services/debts';
import { getExchangeRates } from '../../src/services/currency';
import { DebtCard } from '../../src/components/debts/DebtCard';
import { SettleUpModal } from '../../src/components/debts/SettleUpModal';
import type { DebtWithMembers } from '../../src/types/database';
import type { ExchangeRates } from '../../src/types/currency';

interface DebtWithGroup extends DebtWithMembers {
  _group_name?: string;
}

interface DebtSection {
  title: string;
  type: 'owe' | 'owed';
  data: DebtWithGroup[];
}

export default function ActivityScreen() {
  const { user } = useAuth();
  const [debts, setDebts] = useState<DebtWithGroup[]>([]);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [myMemberIds, setMyMemberIds] = useState<string[]>([]);
  const [homeCurrency, setHomeCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settleDebt, setSettleDebt] = useState<DebtWithMembers | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [fetchedDebts, fetchedRates] = await Promise.all([
        fetchMyDebts(user.id),
        getExchangeRates(),
      ]);

      // Extract member IDs for direction detection
      const { supabase } = await import('../../src/lib/supabase');
      const { data: memberships } = await supabase
        .from('group_members')
        .select('id')
        .eq('user_id', user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('home_currency')
        .eq('id', user.id)
        .single();

      setMyMemberIds(memberships?.map((m) => m.id) ?? []);
      setHomeCurrency(profile?.home_currency ?? 'USD');
      setDebts(fetchedDebts);
      setRates(fetchedRates);
    } catch (err) {
      // Silently handle errors for now — the UI shows empty state
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscription
  useEffect(() => {
    const unsubscribe = subscribeToAllDebts(() => {
      loadData();
    });
    return unsubscribe;
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleSettle = useCallback((debtId: string) => {
    const debt = debts.find((d) => d.id === debtId);
    if (debt) setSettleDebt(debt);
  }, [debts]);

  const handleSettled = useCallback(() => {
    setSettleDebt(null);
    loadData();
  }, [loadData]);

  // Split debts into "You owe" and "Owed to you" sections
  const sections = buildSections(debts, myMemberIds);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Activity</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text
              style={[
                styles.sectionTitle,
                section.type === 'owe' ? styles.sectionTitleOwe : styles.sectionTitleOwed,
              ]}
            >
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <DebtCard
            debt={item}
            myMemberIds={myMemberIds}
            homeCurrency={homeCurrency}
            rates={rates}
            onSettle={handleSettle}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>0</Text>
            </View>
            <Text style={styles.emptyTitle}>All settled up</Text>
            <Text style={styles.emptySubtitle}>
              No outstanding debts. Scan a receipt to get started.
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
      />

      <SettleUpModal
        visible={settleDebt !== null}
        debt={settleDebt}
        homeCurrency={homeCurrency}
        rates={rates}
        onClose={() => setSettleDebt(null)}
        onSettled={handleSettled}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSections(
  debts: DebtWithGroup[],
  myMemberIds: string[]
): DebtSection[] {
  const youOwe: DebtWithGroup[] = [];
  const owedToYou: DebtWithGroup[] = [];

  for (const debt of debts) {
    if (myMemberIds.includes(debt.from_member)) {
      youOwe.push(debt);
    } else {
      owedToYou.push(debt);
    }
  }

  const sections: DebtSection[] = [];

  if (youOwe.length > 0) {
    sections.push({ title: 'You owe', type: 'owe', data: youOwe });
  }

  if (owedToYou.length > 0) {
    sections.push({ title: 'Owed to you', type: 'owed', data: owedToYou });
  }

  return sections;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surfacePrimary,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: Colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    paddingTop: 20,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sectionTitleOwe: {
    color: Colors.negative,
  },
  sectionTitleOwed: {
    color: Colors.positive,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  itemSeparator: {
    height: 10,
  },
  sectionSeparator: {
    height: 0,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accentSurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIconText: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.accent,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
