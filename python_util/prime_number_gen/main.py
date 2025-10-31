import time
import collections # Used for defaultdict in factor_num

# --- Configuration / CHANGE THESE!!!---
MAX_LIMIT = 10000000
PYTHON_OUTPUT_FILE = "primes_list_10M.py" # Output file for Python list
JS_OUTPUT_FILE = "primes_10M.js" # New output file for JavaScript array
# ---------------------

# Module-level variables (will be used for memoization and factorization):
# factors: {number: {prime: count, ...}}
factors = {}
# primes: stores the list of all primes up to MAX_LIMIT
primes = []

def sieve_primes(limit):
    """
    Implements the Sieve of Eratosthenes to efficiently find all primes up to 'limit'.
    Returns a list of prime numbers.
    """
    # Initialize a boolean list where is_prime[i] is True.
    is_prime = [True] * (limit + 1)
    is_prime[0] = is_prime[1] = False # 0 and 1 are not prime

    p = 2
    # We only need to check factors up to the square root of the limit
    while (p * p <= limit):
        # If is_prime[p] is True, it is a prime number
        if is_prime[p]:
            # Mark all multiples of p starting from p^2 as not prime
            for i in range(p * p, limit + 1, p):
                is_prime[i] = False
        p += 1

    # Collect the indices where the value is still True
    prime_list = [i for i, is_p in enumerate(is_prime) if is_p]
    return prime_list

def factor_num(n):
    """
    Finds the prime factors of n and caches the result in the global 'factors' dictionary.
    Factors structure: {number: {prime: count, ...}}
    Assumes the global 'primes' list has been populated by sieve_primes.
    This uses memoization to avoid duplicating factorization work.
    """
    # 1. Check the hash (factors dictionary) first (Memoization)
    if n in factors:
        return factors[n]

    # Handle trivial cases
    if n <= 1:
        factors[n] = {}
        return {}

    temp_n = n
    prime_factors = collections.defaultdict(int)

    # 2. Trial division using the pre-calculated global primes list
    for p in primes:
        # Optimization: stop checking if the prime is larger than the remaining number's square root
        if p * p > temp_n:
            break

        while temp_n % p == 0:
            prime_factors[p] += 1
            temp_n //= p

    # 3. If temp_n is greater than 1, it is a prime factor itself
    # This covers cases where the number is a large prime, or its largest factor is a prime > MAX_LIMIT
    if temp_n > 1:
        prime_factors[temp_n] += 1

    # 4. Cache the result before returning
    factors[n] = dict(prime_factors)
    return factors[n]

def main():
    '''Make prime numbers up to MAX_LIMIT, populate the global primes list, and output to a Python list file and a JavaScript array file.'''
    print(f"--- Prime Number Generation ---")
    print(f"Goal: Find all primes up to {MAX_LIMIT:,}.")
    print(f"Using the efficient Sieve of Eratosthenes algorithm.")
    print("-" * 35)

    start_time = time.time()

    # Generate the primes using the Sieve
    found_primes = sieve_primes(MAX_LIMIT)

    end_time = time.time()
    elapsed = end_time - start_time

    # Populate the global 'primes' list for use by factor_num()
    global primes
    primes[:] = found_primes

    print(f"✅ Primes found: {len(primes):,}")
    print(f"⏱️ Time taken: {elapsed:.2f} seconds")

    # --- Write Python List File ---
    print(f"💾 Writing Python list to file: {PYTHON_OUTPUT_FILE}")
    try:
        # Format the list as a string: "primes = [2, 3, 5, 7, ...]"
        python_list_str = 'primes = [' + ', '.join(map(str, primes)) + ']'

        with open(PYTHON_OUTPUT_FILE, 'w') as f:
            f.write(python_list_str)
        print(f"✅ Successfully wrote Python list to {PYTHON_OUTPUT_FILE}")
    except IOError as e:
        print(f"Error writing Python file: {e}")

    # --- Write JavaScript Array File ---
    print(f"💾 Writing JavaScript array to file: {JS_OUTPUT_FILE}")
    try:
        # Format the array as a JavaScript const: "const primes = [2, 3, 5, 7, ...];"
        # Includes export for modern module usage
        js_list_content = 'const primes = [' + ', '.join(map(str, primes)) + '];\n\nexport default primes;'

        with open(JS_OUTPUT_FILE, 'w') as f:
            f.write(js_list_content)
        print(f"✅ Successfully wrote JavaScript array to {JS_OUTPUT_FILE}")
    except IOError as e:
        print(f"Error writing JavaScript file: {e}")


if __name__ == "__main__":
    main()

