function deepClone(value) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch (_error) {
      // Fall back to JSON path if structuredClone fails
    }
  }
  return JSON.parse(JSON.stringify(value));
}

export function createWeeklyReportSupabaseStub(initialState = {}) {
  const state = {
    progressRows: initialState.progressRows ? deepClone(initialState.progressRows) : [],
    notes: initialState.notes ? deepClone(initialState.notes) : [],
    meditations: initialState.meditations ? deepClone(initialState.meditations) : [],
    user: initialState.user ? deepClone(initialState.user) : null,
    profile: initialState.profile ? deepClone(initialState.profile) : null,
    weeklyReports: initialState.weeklyReports ? deepClone(initialState.weeklyReports) : []
  };

  function cloneProgressRows() {
    return state.progressRows.map((row) => ({ ...row }));
  }

  return {
    state,
    from(table) {
      switch (table) {
        case 'weekly_progress': {
          return {
            mode: null,
            updates: null,
            filters: { eq: [], is: [], lte: [] },
            select() {
              if (this.mode !== 'update') {
                this.mode = 'select';
              }
              return this;
            },
            update(payload) {
              this.mode = 'update';
              this.updates = payload;
              this.filters = { eq: [], is: [], lte: [] };
              return this;
            },
            eq(column, value) {
              this.filters.eq.push([column, value]);
              return this;
            },
            gte() { return this; },
            is(column, value) {
              this.filters.is.push([column, value]);
              return this;
            },
            lte(column, value) {
              this.filters.lte.push([column, value]);
              return this;
            },
            order() { return this; },
            limit() {
              if (this.mode === 'update') {
                const originalRows = cloneProgressRows();
                const matchesIndex = originalRows.reduce((indices, row, idx) => {
                  const matchesEq = this.filters.eq.every(([col, val]) => row[col] === val);
                  const matchesIs = this.filters.is.every(([col, val]) => (val === null ? row[col] === null : row[col] === val));
                  const matchesLte = this.filters.lte.every(([col, val]) => {
                    if (!row[col]) return false;
                    return new Date(row[col]).getTime() <= new Date(val).getTime();
                  });
                  if (matchesEq && matchesIs && matchesLte) {
                    indices.push(idx);
                  }
                  return indices;
                }, []);

                state.progressRows = state.progressRows.map((row, idx) => (
                  matchesIndex.includes(idx) ? { ...row, ...this.updates } : row
                ));

                const claimedRows = matchesIndex.map((idx) => state.progressRows[idx]);
                return Promise.resolve({ data: claimedRows, error: null });
              }
              return Promise.resolve({ data: cloneProgressRows(), error: null });
            },
            single() {
              if (this.mode === 'update') {
                state.progressRows = state.progressRows.map((row) => {
                  const matchesEq = this.filters.eq.every(([col, val]) => row[col] === val);
                  const matchesIs = this.filters.is.every(([col, val]) => (val === null ? row[col] === null : row[col] === val));
                  if (matchesEq && matchesIs) {
                    return { ...row, ...this.updates };
                  }
                  return row;
                });
                const matching = state.progressRows.find((row) => this.filters.eq.every(([col, val]) => row[col] === val));
                return Promise.resolve({ data: matching ?? null, error: null });
              }
              return Promise.resolve({ data: cloneProgressRows()[0] ?? null, error: null });
            },
            maybeSingle() {
              return Promise.resolve({ data: cloneProgressRows()[0] ?? null, error: null });
            }
          };
        }
        case 'notes': {
          return {
            select() { return this; },
            eq() { return this; },
            gte() { return this; },
            lt() { return this; },
            order() { return Promise.resolve({ data: deepClone(state.notes), error: null }); }
          };
        }
        case 'meditations': {
          return {
            select() { return this; },
            eq() { return this; },
            not() { return this; },
            gte() { return this; },
            lt() { return this; },
            order() { return Promise.resolve({ data: deepClone(state.meditations), error: null }); }
          };
        }
        case 'users': {
          return {
            select() { return this; },
            eq() { return this; },
            maybeSingle() { return Promise.resolve({ data: deepClone(state.user), error: null }); }
          };
        }
        case 'profiles': {
          return {
            select() { return this; },
            eq() { return this; },
            maybeSingle() { return Promise.resolve({ data: deepClone(state.profile), error: null }); }
          };
        }
        case 'weekly_reports': {
          return {
            upsert(payload) {
              state.weeklyReports.push(deepClone(payload));
              return Promise.resolve({ data: null, error: null });
            }
          };
        }
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    }
  };
}

export default createWeeklyReportSupabaseStub;
